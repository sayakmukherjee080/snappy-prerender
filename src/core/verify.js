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
 * Reloads every written route with the real client bundle and reports React
 * hydration errors. This is the pass that catches markup that only breaks once the
 * app re-attaches, which plain HTML diffing cannot see.
 */
export async function verifyRoutes({ browser, origin, routes, config }) {
  const { results, errors } = await mapLimit(routes, config.concurrency, (route) =>
    verifyRoute({ browser, origin, route, config }),
  );
  const verified = results.filter(Boolean);
  return {
    routes: verified,
    ok: verified.every((entry) => entry.ok) && errors.length === 0,
    errors: errors.map(({ item, error }) => ({ route: item, message: error.message })),
  };
}

/**
 * Verifies one route against the same request-blocking rules as the render pass, so
 * third-party scripts cannot introduce noise that looks like a hydration failure.
 */
async function verifyRoute({ browser, origin, route, config }) {
  const context = await browser.newContext({
    viewport: config.viewport,
    storageState: config.storageState ?? undefined,
  });
  const page = await context.newPage();
  const hydrationErrors = [];
  const otherErrors = [];
  const collect = (message) => {
    if (isHydrationError(message)) hydrationErrors.push(message);
    else otherErrors.push(message);
  };
  page.on('console', (message) => {
    if (message.type() === 'error') collect(message.text());
  });
  page.on('pageerror', (error) => collect(error.message));

  const tracker = trackNetwork(page);
  try {
    if (config.blockThirdParty) {
      await blockThirdPartyRequests(page, origin, config.allowedHosts);
    }
    await page.goto(toServerUrl(route, config.base, origin), {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    await settlePage(page, config, tracker);
    return { route, hydrationErrors, otherErrors, ok: hydrationErrors.length === 0 };
  } finally {
    tracker.stop();
    await context.close();
  }
}
