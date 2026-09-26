import { blockThirdPartyRequests } from './blocking.js';
import { toServerUrl } from './routes.js';
import { mapLimit } from './scheduler.js';
import { settlePage, trackNetwork } from './settle.js';

const HYDRATION_PATTERNS = [
  /hydrat/i,
  /did not match/i,
  /server-rendered HTML/i,
  /react\.dev\/errors\/(418|419|421|422|423|424|425)/i,
  /Minified React error #(418|419|421|422|423|424|425)\b/i,
];

// Containers used by the common React setups, so the probe can find the prerendered
// subtree without configuration.
const CONTAINER_SELECTOR = '#root, #app, #__next';

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
 * Classifies a console or page error as a React hydration failure. Exported so the
 * pattern set is testable without a browser. Patterns stay narrow on purpose: a
 * false positive fails a user's build, so unrelated 4xx React codes and generic
 * "does not match" messages are deliberately not treated as hydration errors.
 */
export function isHydrationError(message) {
  return HYDRATION_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Classifies how a prerendered page booted. `hydrated` means the app adopted the
 * markup, `re-rendered` means it discarded it, `undetected` means no React root was
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
export async function verifyRoutes({ browser, origin, routes, config }) {
  const { results, errors } = await mapLimit(routes, config.concurrency, (route) =>
    verifyRoute({ browser, origin, route, config }),
  );
  const verified = results.filter(Boolean);
  const modes = { hydrated: 0, 're-rendered': 0, undetected: 0, unknown: 0 };
  for (const entry of verified) modes[entry.mode] += 1;
  return {
    routes: verified,
    modes,
    ok: verified.every((entry) => entry.ok) && errors.length === 0,
    errors: errors.map(({ item, error }) => ({ route: item, message: error.message })),
  };
}

/**
 * Verifies one route against the same request rules as the render pass, so what is
 * verified matches what was rendered.
 */
async function verifyRoute({ browser, origin, route, config }) {
  const context = await browser.newContext({
    viewport: config.viewport,
    storageState: config.storageState ?? undefined,
    userAgent: config.userAgent ?? undefined,
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
  });
  const page = await context.newPage();
  const hydrationErrors = [];
  const consoleErrors = [];
  const pageErrors = [];
  // Hydration messages arrive through either channel, so both are classified the same way.
  const collect = (message, target) => {
    if (isHydrationError(message)) hydrationErrors.push(message);
    else target.push(message);
  };
  page.on('console', (message) => {
    if (message.type() === 'error') collect(message.text(), consoleErrors);
  });
  page.on('pageerror', (error) => collect(error.message, pageErrors));

  const tracker = trackNetwork(page);
  try {
    if (config.blockThirdParty) {
      await blockThirdPartyRequests(page, origin, config.allowedHosts);
    }
    await page.addInitScript(bootProbe);
    await page.goto(toServerUrl(route, config.base, origin), {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    await settlePage(page, config, tracker);

    const boot = await page.evaluate((selector) => {
      const probe = window.__snappyBoot ?? {};
      const container =
        document.querySelector(selector) ?? document.body?.firstElementChild ?? null;
      const frameworkMounted = container
        ? Object.keys(container).some(
            (key) => key.startsWith('__reactContainer') || key === '_reactRootContainer',
          )
        : false;
      const child = probe.prerenderedChild ?? null;
      return { frameworkMounted, markupPreserved: child ? child.isConnected : null };
    }, CONTAINER_SELECTOR);

    return {
      route,
      hydrationErrors,
      consoleErrors,
      pageErrors,
      ok: hydrationErrors.length === 0,
      mode: classifyBoot(boot),
      markupPreserved: boot.markupPreserved,
    };
  } finally {
    tracker.stop();
    await context.close();
  }
}
