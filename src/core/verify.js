import fs from 'node:fs/promises';
import path from 'node:path';
import { blockThirdPartyRequests } from './blocking.js';
import { DEFAULTS } from './config.js';
import { frameworkFromMarkers, isHydrationError } from './frameworks.js';
import { compareContainers } from './hydration-diff.js';
import { routeToFile } from './output.js';
import { CONTAINER_SELECTOR, readBootState } from './page-content.js';
import { resolveRouteConfig } from './route-config.js';
import { normaliseRoute, toServerUrl } from './routes.js';
import { settlePage, trackNetwork } from './settle.js';

/**
 * Page-side probe installed before navigation. It remembers the first prerendered
 * child of the app container, which is what lets the verifier tell hydration from a
 * client re-render: hydration adopts those nodes, createRoot discards them.
 */
function bootProbe() {
  window.__snappyBoot = { prerenderedChild: null };

  // Records the container's first child while the parser is still building the page.
  const capture = () => {
    if (window.__snappyBoot.prerenderedChild) return;
    const container =
      document.querySelector('#root, #app, #__next') ?? document.body?.firstElementChild;
    if (!container) return;
    window.__snappyBoot.prerenderedChild =
      container.firstElementChild ?? container.firstChild ?? null;
  };

  const observer = new MutationObserver(capture);
  observer.observe(document, { childList: true, subtree: true });
  window.addEventListener('load', () => {
    observer.disconnect();
    capture();
  });
}

/**
 * Classifies how a prerendered page booted. `hydrated` means the app adopted the
 * markup, `re-rendered` means it discarded it, `undetected` means no framework root was
 * found on the container, and `unknown` means the prerendered child was never seen.
 */
export function classifyBoot({ markupPreserved, frameworkMounted }) {
  if (markupPreserved === null) return 'unknown';
  if (!frameworkMounted) return 'undetected';
  return markupPreserved ? 'hydrated' : 're-rendered';
}

/**
 * Reloads every written route with the real client bundle and reports React
 * hydration errors plus how each route booted. This is the pass that catches markup
 * that only breaks once the app re-attaches, and apps that never attach to it at all.
 */
export async function verifyRoutes({ browser, origin, routes, config, outputDir = null }) {
  const results = new Array(routes.length).fill(undefined);
  const errors = [];
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(config.concurrency, routes.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      let sharedContext = null;
      try {
        if (config.reuseVerificationContext && routes.length > 0) {
          sharedContext = await createContext(browser, config);
        }
        while (cursor < routes.length) {
          const index = cursor;
          cursor += 1;
          const route = routes[index];
          try {
            results[index] = await verifyRoute({
              browser,
              origin,
              route,
              config: resolveRouteConfig(config, route),
              outputDir,
              context: sharedContext,
            });
          } catch (error) {
            errors.push({ item: route, error });
          }
        }
      } finally {
        if (sharedContext) await sharedContext.close();
      }
    }),
  );
  const verified = results.filter(Boolean);
  const modes = { hydrated: 0, 're-rendered': 0, undetected: 0, unknown: 0 };
  const frameworks = {};
  for (const entry of verified) {
    modes[entry.mode] += 1;
    const name = entry.framework ?? 'unknown';
    frameworks[name] = (frameworks[name] ?? 0) + 1;
  }
  return {
    routes: verified,
    modes,
    frameworks,
    ok: verified.every((entry) => entry.ok) && errors.length === 0,
    errors: errors.map(({ item, error }) => ({ route: item, message: error.message })),
  };
}

// Creates the browser context a verification worker reuses across routes.
function createContext(browser, config) {
  return browser.newContext({
    viewport: config.viewport,
    storageState: config.storageState ?? undefined,
    userAgent:
      config.userAgent === DEFAULTS.userAgent ? undefined : (config.userAgent ?? undefined),
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    reducedMotion: config.freezeAnimations ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  });
}

/**
 * Verifies one route against the same request rules as the render pass, so what is
 * verified matches what was rendered. A supplied context is reused by the worker; the
 * page is always fresh.
 */
async function verifyRoute({ browser, origin, route, config, outputDir, context = null }) {
  const ownsContext = context === null;
  const activeContext = context ?? (await createContext(browser, config));
  const page = await activeContext.newPage();
  const consoleMessages = [];
  const pageMessages = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleMessages.push(message.text());
  });
  page.on('pageerror', (error) => pageMessages.push(error.message));

  const tracker = trackNetwork(page);
  try {
    if (config.blockThirdParty) {
      await blockThirdPartyRequests(page, origin, config.allowedHosts);
    }
    await page.addInitScript(bootProbe);
    const response = await page.goto(toServerUrl(route, config.base, origin), {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    const status = response?.status() ?? null;
    await settlePage(page, config, tracker);
    const { empty, statusCode, markers, markupPreserved } = await readBootState(page);
    const notFoundRoute = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;
    const isNotFoundRoute = notFoundRoute !== null && normaliseRoute(route) === notFoundRoute;
    const notFound = statusCode === 404 || isNotFoundRoute;

    const detected = frameworkFromMarkers(markers, config.framework);
    // Classify only after the framework is known, so an explicit `framework` choice and
    // the detected framework select the matching message patterns.
    const hydrationErrors = [];
    const consoleErrors = [];
    const pageErrors = [];
    for (const message of consoleMessages) {
      if (isHydrationError(message, detected.name ?? 'auto')) hydrationErrors.push(message);
      else consoleErrors.push(message);
    }
    for (const message of pageMessages) {
      if (isHydrationError(message, detected.name ?? 'auto')) hydrationErrors.push(message);
      else pageErrors.push(message);
    }
    const mode = classifyBoot({
      markupPreserved,
      frameworkMounted: detected.mounted,
    });
    let firstMismatch = null;
    if (outputDir && (hydrationErrors.length > 0 || mode === 're-rendered')) {
      const liveHtml = await page.evaluate((selector) => {
        const container = document.querySelector(selector) ?? document.body;
        return container?.outerHTML ?? null;
      }, CONTAINER_SELECTOR);
      const file = path.join(outputDir, routeToFile(route, config));
      const expectedHtml = await fs.readFile(file, 'utf8').catch(() => null);
      if (liveHtml && expectedHtml) firstMismatch = compareContainers(expectedHtml, liveHtml);
    }

    return {
      route,
      status,
      statusCode,
      notFound,
      framework: detected.name,
      empty,
      hydrationErrors,
      consoleErrors,
      pageErrors,
      ok:
        hydrationErrors.length === 0 &&
        (status === null || status < 400 || (isNotFoundRoute && status === 404)) &&
        !empty,
      mode,
      firstMismatch,
      markupPreserved,
    };
  } finally {
    tracker.stop();
    await page.close();
    if (ownsContext) await activeContext.close();
  }
}
