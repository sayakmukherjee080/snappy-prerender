import fs from 'node:fs/promises';
import path from 'node:path';
import { captureFormState } from './form-state.js';
import { inlineStylesheets } from './inline-css.js';
import { createResourceCollector } from './resources.js';
import { toAppRoute, toServerUrl } from './routes.js';
import { captureRuntimeStyles } from './runtime-styles.js';
import { freezeAnimations, scrollThroughPage, settlePage, trackNetwork } from './settle.js';

/**
 * Renders one route in a fresh browser context and returns the serialised DOM plus
 * the same-origin links discovered on it. Context isolation keeps cookies and
 * storage from leaking between routes. When a screenshot path is supplied the route
 * is captured as an image instead of HTML.
 */
export async function renderRoute({ browser, origin, route, config, screenshotPath }) {
  const context = await browser.newContext({
    viewport: config.viewport,
    storageState: config.storageState ?? undefined,
    userAgent: config.userAgent ?? undefined,
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    reducedMotion: config.freezeAnimations ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const collector = createResourceCollector({
    origin,
    base: config.base,
    allowedHosts: config.allowedHosts,
    blockThirdParty: config.blockThirdParty,
    collectJson: config.cacheAjaxRequests,
  });
  await collector.install(page);
  const tracker = trackNetwork(page);
  try {
    await page.goto(toServerUrl(route, config.base, origin), {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    await settlePage(page, config, tracker);

    if (config.captureRuntimeStyles) await captureRuntimeStyles(page);
    if (config.captureFormState) await captureFormState(page);
    if (config.inlineCss === true || config.inlineCss === 'inline') {
      await inlineStylesheets({ page, minifyCssOptions: config.minifyCss });
    }
    await collector.settled();
    await injectCapturedState(page, collector.json);
    if (config.freezeAnimations) await freezeAnimations(page);
    if (config.scrollToBottom) await scrollThroughPage(page, config);

    const links = await collectLinks(page, config.base, origin);

    if (screenshotPath) {
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return { route, links, pageErrors, collector, screenshot: true };
    }

    const html = await page.content();
    return { route, html, links, pageErrors, collector };
  } finally {
    tracker.stop();
    await context.close();
  }
}

/**
 * Injects captured JSON responses as window.snapStore and anything the app exposes
 * through window.snapSaveState, before the first script runs. The client can then
 * replay the same data during hydration instead of re-fetching and mismatching.
 */
async function injectCapturedState(page, cache) {
  const store = Object.fromEntries(cache);
  await page.evaluate((captured) => {
    const UNSAFE_CHARS = /[<>/\u2028\u2029]/g;
    const ESCAPED_CHARS = {
      '<': '\\u003C',
      '>': '\\u003E',
      '/': '\\u002F',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    };
    const escapeJson = (value) =>
      JSON.stringify(value).replace(UNSAFE_CHARS, (char) => ESCAPED_CHARS[char]);

    const parts = [];
    if (Object.keys(captured).length > 0) {
      parts.push(`window.snapStore=${escapeJson(captured)};`);
    }
    const state = typeof window.snapSaveState === 'function' ? window.snapSaveState() : null;
    if (state && typeof state === 'object') {
      for (const [key, value] of Object.entries(state)) {
        // Both the key and the value are escaped: JSON.stringify alone leaves angle
        // brackets and slashes intact, which would let a dynamic key close the tag.
        parts.push(`window[${escapeJson(key)}]=${escapeJson(value)};`);
      }
    }
    if (parts.length === 0) return;

    const script = document.createElement('script');
    script.textContent = parts.join('');
    const first = document.scripts[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
  }, store);
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
