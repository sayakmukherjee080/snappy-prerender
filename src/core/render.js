import { blockThirdPartyRequests } from './blocking.js';
import { toAppRoute, toServerUrl } from './routes.js';
import { freezeAnimations, scrollThroughPage, settlePage, trackNetwork } from './settle.js';

/**
 * Renders one route in a fresh browser context and returns the serialised DOM plus
 * the same-origin links discovered on it. Context isolation keeps cookies and
 * storage from leaking between routes.
 */
export async function renderRoute({ browser, origin, route, config }) {
  const context = await browser.newContext({
    viewport: config.viewport,
    storageState: config.storageState ?? undefined,
    reducedMotion: config.freezeAnimations ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

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
    if (config.freezeAnimations) await freezeAnimations(page);
    if (config.scrollToBottom) await scrollThroughPage(page, config);

    const html = await page.content();
    const links = await collectLinks(page, config.base, origin);
    return { route, html, links, pageErrors };
  } finally {
    tracker.stop();
    await context.close();
  }
}

/**
 * Collects same-origin link targets from the rendered page and converts them to
 * app-relative routes for the crawler. Off-origin links are ignored so external
 * URLs can never be mistaken for routes and written into the output directory.
 */
async function collectLinks(page, base, origin) {
  const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((anchor) => anchor.href));
  const routes = [];
  for (const href of hrefs) {
    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }
    if (parsed.origin !== origin) continue;
    const route = toAppRoute(href, base);
    if (route) routes.push(route);
  }
  return routes;
}
