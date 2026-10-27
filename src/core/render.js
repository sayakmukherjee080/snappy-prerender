import { captureFormState } from './form-state.js';
import { inlineStylesheets } from './inline-css.js';
import { isPageEmpty } from './page-content.js';
import { createResourceCollector } from './resources.js';
import { toAppRoute, toServerUrl } from './routes.js';
import { captureRuntimeStyles } from './runtime-styles.js';
import { freezeAnimations, scrollThroughPage, settlePage, trackNetwork } from './settle.js';
import { separateTextNodes } from './text-separators.js';

const SCRIPT_ESCAPES = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

// Serialises a value for embedding in a script element without allowing tag breakout.
function escapeForScript(value) {
  return JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, (char) => SCRIPT_ESCAPES[char]);
}

/**
 * Renders one route in a fresh browser context and returns the serialised DOM plus
 * the same-origin links discovered on it. Context isolation keeps cookies and
 * storage from leaking between routes. When a screenshot path is supplied the route
 * is captured as an image instead of HTML.
 */
export async function renderRoute({ browser, origin, route, config, screenshot = false }) {
  const context = await browser.newContext({
    viewport: config.viewport,
    storageState: config.storageState ?? undefined,
    userAgent: config.userAgent ?? undefined,
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    reducedMotion: config.freezeAnimations ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  let inlineCssSkipped = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  // Only same-origin failures are the build's own to fix; a blocked analytics host is
  // not a broken page. Aborted requests are navigations or cancelled fetches, not 404s.
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const parsed = parseHttpUrl(response.url());
    if (parsed?.origin !== origin) return;
    failedRequests.push({ url: response.url(), status: response.status() });
  });
  page.on('requestfailed', (request) => {
    const parsed = parseHttpUrl(request.url());
    if (parsed?.origin !== origin) return;
    const error = request.failure()?.errorText ?? 'request failed';
    if (error.includes('ERR_ABORTED')) return;
    failedRequests.push({ url: request.url(), status: null, error });
  });

  const metadataDefaults = config.metadata
    ? { base: config.base, flatOutput: config.flatOutput, ...config.metadata }
    : null;
  if (metadataDefaults) {
    await page.addInitScript((defaults) => {
      window.__SNAPPY_META__ = defaults;
    }, metadataDefaults);
  }

  const collector = createResourceCollector({
    origin,
    base: config.base,
    allowedHosts: config.allowedHosts,
    blockThirdParty: config.blockThirdParty,
    collectJson: config.cacheAjaxRequests,
    maxCachedBytes: config.maxCachedBytes,
  });
  await collector.install(page);
  const tracker = trackNetwork(page);
  try {
    const response = await page.goto(toServerUrl(route, config.base, origin), {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    if (response && response.status() >= 400) {
      throw new Error(
        `route responded with HTTP ${response.status()}${response.statusText() ? ` ${response.statusText()}` : ''}`,
      );
    }
    await settlePage(page, config, tracker);
    const empty = await isPageEmpty(page);

    if (config.captureRuntimeStyles) await captureRuntimeStyles(page);
    if (config.captureFormState) await captureFormState(page);
    if (config.inlineCss === true || config.inlineCss === 'inline') {
      const inlined = await inlineStylesheets({ page, minifyCssOptions: config.minifyCss });
      inlineCssSkipped = inlined.skipped;
    }
    await collector.settled();
    const stateScript = await injectCapturedState(page, collector.json, {
      externalScripts: config.externalScripts,
      base: config.base,
    });
    if (metadataDefaults) await injectMetadataDefaults(page, metadataDefaults);
    if (config.freezeAnimations) await freezeAnimations(page);
    if (config.scrollToBottom) await scrollThroughPage(page, config);
    await separateTextNodes(page);

    const links = await collectLinks(page, config.base, origin);

    if (screenshot) {
      const buffer = await page.screenshot({
        fullPage: true,
        type: config.saveAs === 'jpeg' ? 'jpeg' : 'png',
      });
      return {
        route,
        links,
        pageErrors,
        consoleErrors,
        failedRequests,
        collector,
        inlineCssSkipped,
        stateScript,
        screenshot: buffer,
        empty,
      };
    }

    const html = await page.content();
    return {
      route,
      html,
      links,
      pageErrors,
      consoleErrors,
      failedRequests,
      collector,
      inlineCssSkipped,
      stateScript,
      empty,
    };
  } finally {
    tracker.stop();
    await context.close();
  }
}

/**
 * Injects captured JSON responses as window.snapStore and anything the app exposes
 * through window.snapSaveState, before the first script runs. The client can then
 * replay the same data during hydration instead of re-fetching and mismatching.
 *
 * Inline by default. With externalScripts the same payload is written as a content-hashed
 * same-origin file and referenced with src, so a strict script-src can allow it without
 * unsafe-inline. Returns that file for the caller to write, or null when nothing was needed.
 */
async function injectCapturedState(page, cache, { externalScripts = false, base = '/' } = {}) {
  const store = Object.fromEntries(cache);
  return page.evaluate(
    async ({ captured, external, basePath }) => {
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
      // Replacing an earlier injection keeps a rerun against already prerendered output
      // byte-identical instead of stacking a second copy of the state script.
      document.querySelectorAll('script[data-snappy-state]').forEach((script) => script.remove());
      if (parts.length === 0) return null;

      // Inserted before the first script so the state exists before the bundle runs.
      const insert = (element) => {
        const first = document.scripts[0];
        if (first?.parentNode) first.parentNode.insertBefore(element, first);
        else document.head.appendChild(element);
      };

      const script = document.createElement('script');
      script.setAttribute('data-snappy-state', '');
      const text = parts.join('');

      if (!external) {
        script.textContent = text;
        insert(script);
        return null;
      }

      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const hash = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 12);
      const file = `snappy/state-${hash}.js`;
      const prefix = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      script.setAttribute('src', `${prefix}/${file}`);
      insert(script);
      return { file, contents: text };
    },
    { captured: store, external: externalScripts === true, basePath: base },
  );
}

/**
 * Persists the metadata defaults into the document itself, so the head component reads the
 * public site URL on the client too, not only while prerendering. Anything the head layer
 * recorded about the tags it overwrote is merged in, and an earlier injection from a previous
 * run is replaced so repeated runs stay identical. Written as inert JSON rather than an
 * executable script, so a strict script-src applies to nothing here.
 */
async function injectMetadataDefaults(page, defaults) {
  const payload = await page.evaluate((fallback) => {
    document.querySelectorAll('script[data-snappy-meta]').forEach((script) => script.remove());
    const current = typeof window === 'undefined' ? null : window.__SNAPPY_META__;
    const recorded = typeof window === 'undefined' ? null : window.__snappyHeadOriginals;
    const merged = { ...(current ?? fallback) };
    if (recorded) merged.originals = recorded;
    return Object.keys(merged).length > 0 ? merged : fallback;
  }, defaults);
  const element = escapeForScript(payload);
  await page.evaluate((text) => {
    const script = document.createElement('script');
    script.setAttribute('type', 'application/json');
    script.setAttribute('data-snappy-meta', '');
    script.textContent = text;
    const first = document.scripts[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
  }, element);
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

// Parses an HTTP URL, returning null for data, blob and other non-network URLs.
function parseHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}
