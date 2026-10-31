import fs from 'node:fs/promises';
import path from 'node:path';
import { blockThirdPartyRequests } from './blocking.js';
import { installClock, installClockScripts } from './clock.js';
import { DEFAULTS } from './config.js';
import { frameworkFromMarkers, isHydrationError } from './frameworks.js';
import { compareContainers } from './hydration-diff.js';
import { isHydrationAllowed, resolveHydrationPolicy } from './hydration-policy.js';
import { localeContextOptions, localeStorageState, seedLocaleContext } from './locale-context.js';
import { activeLocale } from './locales.js';
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
  window.__snappyBoot = { prerenderedChild: null, prerenderedChain: [] };

  // Records the container's first child and the first-element chain beneath it while the
  // parser is still building the page. A framework that keeps only the outer wrapper but
  // replaces everything inside it is a re-render, so checking the wrapper alone is not
  // enough to call a route hydrated.
  const capture = () => {
    const container =
      document.querySelector('#root, #app, #__next') ?? document.body?.firstElementChild;
    if (!container) return;
    const boot = window.__snappyBoot;
    if (!boot.prerenderedChild) {
      boot.prerenderedChild = container.firstElementChild ?? container.firstChild ?? null;
    }
    let node = container.firstElementChild;
    for (let depth = 0; node && depth < 6; depth += 1) {
      if (!boot.prerenderedChain[depth]) boot.prerenderedChain[depth] = node;
      node = node.firstElementChild;
    }
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
export async function verifyRoutes({
  browser,
  origin,
  routes,
  config,
  outputDir = null,
  routeLocales = new Map(),
}) {
  const policySkipped = routes.filter((route) => resolveHydrationPolicy(config, route) === 'skip');
  const policySkippedSet = new Set(policySkipped);
  const toVerify = routes.filter((route) => !policySkippedSet.has(route));
  const results = new Array(toVerify.length).fill(undefined);
  const errors = [];
  let cursor = 0;
  const canReuse = config.reuseVerificationContext && !config.locales && !config.seoLocale;
  const workerCount = Math.max(1, Math.min(config.concurrency, toVerify.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      let sharedContext = null;
      try {
        if (canReuse && toVerify.length > 0) {
          sharedContext = await createContext(browser, config, activeLocale(config.locales));
        }
        while (cursor < toVerify.length) {
          const index = cursor;
          cursor += 1;
          const route = toVerify[index];
          try {
            results[index] = await verifyRoute({
              browser,
              origin,
              route,
              config: resolveRouteConfig(config, route),
              outputDir,
              context: sharedContext,
              locale:
                routeLocales.get(route)?.locale ??
                (config.locales?.mode === 'single' ? activeLocale(config.locales) : null),
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
    allowed: verified.filter((entry) => entry.allowed).length,
    allowedRerender: verified.filter((entry) => entry.allowed && entry.mode === 're-rendered')
      .length,
    skippedRoutes: policySkipped,
    ok: verified.every((entry) => entry.ok) && errors.length === 0,
    errors: errors.map(({ item, error }) => ({ route: item, message: error.message })),
  };
}

// Creates the browser context a verification worker reuses across routes.
function createContext(browser, config, locale = null) {
  return browser.newContext({
    viewport: config.viewport,
    storageState: localeStorageState(config, locale),
    userAgent:
      config.userAgent === DEFAULTS.userAgent ? undefined : (config.userAgent ?? undefined),
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    reducedMotion: config.freezeAnimations ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
    ...localeContextOptions(config, locale),
  });
}

/**
 * Verifies one route against the same request rules as the render pass, so what is
 * verified matches what was rendered. A supplied context is reused by the worker; the
 * page is always fresh.
 */
async function verifyRoute({
  browser,
  origin,
  route,
  config,
  outputDir,
  context = null,
  locale = null,
}) {
  const ownsContext = context === null;
  const activeContext = context ?? (await createContext(browser, config, locale));
  const page = await activeContext.newPage();
  await installClock(page, config.fixedTime ?? null);
  await installClockScripts(page, {
    fixedTime: config.fixedTime ?? null,
    randomSeed: config.randomSeed ?? null,
  });
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
    await seedLocaleContext({
      page,
      context: activeContext,
      origin,
      config,
      route,
      locale,
      phase: 'verify',
    });
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
    const hydrationPolicy = resolveHydrationPolicy(config, route);
    const allowed = isHydrationAllowed(hydrationPolicy, { mode, hydrationErrors });
    const effectiveHydrationErrors = allowed ? [] : hydrationErrors;

    return {
      route,
      status,
      statusCode,
      notFound,
      framework: detected.name,
      empty,
      hydrationErrors: effectiveHydrationErrors,
      ignoredHydrationErrors: allowed ? hydrationErrors : [],
      hydrationPolicy,
      allowed,
      consoleErrors,
      pageErrors,
      ok:
        effectiveHydrationErrors.length === 0 &&
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
