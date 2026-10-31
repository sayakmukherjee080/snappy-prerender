import { installClock, installClockScripts } from './clock.js';
import { captureFormState } from './form-state.js';
import { inlineStylesheets } from './inline-css.js';
import { localeContextOptions, localeStorageState, seedLocaleContext } from './locale-context.js';
import { readPageState } from './page-content.js';
import { createResourceCollector } from './resources.js';
import { normaliseRoute, toAppRoute, toServerUrl } from './routes.js';
import { captureRuntimeStyles } from './runtime-styles.js';
import { freezeAnimations, scrollThroughPage, settlePage, trackNetwork } from './settle.js';
import { readRenderSnapshot } from './text-separators.js';

/**
 * Renders one route in a fresh browser context and returns the serialised DOM plus
 * the same-origin links discovered on it. Context isolation keeps cookies and
 * storage from leaking between routes. When a screenshot path is supplied the route
 * is captured as an image instead of HTML.
 */
export async function renderRoute({
  browser,
  origin,
  route,
  locale = null,
  config,
  screenshot = false,
  traceFile = null,
  caches = null,
}) {
  const context = await browser.newContext({
    viewport: config.viewport,
    storageState: localeStorageState(config, locale),
    userAgent: config.userAgent ?? undefined,
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    reducedMotion: config.freezeAnimations ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
    ...localeContextOptions(config, locale),
  });
  let tracing = false;
  if (traceFile) {
    await context.tracing.start({ screenshots: false, snapshots: true, sources: false });
    tracing = true;
  }
  const page = await context.newPage();
  await installClock(page, config.fixedTime ?? null);
  await installClockScripts(page, {
    fixedTime: config.fixedTime ?? null,
    randomSeed: config.randomSeed ?? null,
  });
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
  await seedLocaleContext({
    page,
    context,
    origin,
    config,
    route,
    locale,
    phase: 'render',
  });
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
  await page.addInitScript(() => {
    window.__snappyLcp = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const element = entry.element;
          window.__snappyLcp.push({
            url: entry.url || element?.currentSrc || element?.src || null,
          });
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Older engines simply do not report LCP; preload injection falls back to no hint.
    }
  });
  const tracker = trackNetwork(page);
  try {
    const response = await page.goto(toServerUrl(route, config.base, origin), {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    const notFoundRoute = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;
    const isNotFoundRoute = notFoundRoute !== null && normaliseRoute(route) === notFoundRoute;
    if (response && response.status() >= 400) {
      // A configured 404 route may legitimately answer with HTTP 404; every other status
      // is a failure, and the marker cannot be read before the navigation completes.
      if (!(response.status() === 404 && isNotFoundRoute)) {
        const error = new Error(
          `route responded with HTTP ${response.status()}${response.statusText() ? ` ${response.statusText()}` : ''}`,
        );
        // A server error can be transient and is retried; a client error is the app's own.
        error.retryable = response.status() >= 500;
        throw error;
      }
    }
    await settlePage(page, config, tracker);
    const { empty, statusCode } = await readPageState(page);
    const finalUrl = page.url();

    if (config.captureRuntimeStyles) await captureRuntimeStyles(page);
    if (config.captureFormState) await captureFormState(page);
    if (config.inlineCss === true || config.inlineCss === 'inline') {
      const inlined = await inlineStylesheets({
        page,
        minifyCssOptions: config.minifyCss,
        cache: caches?.inlineCss ?? null,
      });
      inlineCssSkipped = inlined.skipped;
      if (caches?.inlineCss) {
        for (const sheet of inlined.fetched ?? []) caches.inlineCss.set(sheet.href, sheet.css);
      }
    }
    await collector.settled();
    const stateScript = await injectCapturedState(page, collector.json, {
      externalScripts: config.externalScripts,
      base: config.base,
    });
    if (metadataDefaults) await injectMetadataDefaults(page, metadataDefaults);
    if (config.freezeAnimations) await freezeAnimations(page);
    if (config.scrollToBottom) await scrollThroughPage(page, config);
    const { lcpUrl, hrefs } = await readRenderSnapshot(page);
    let lcpImage = null;
    if (lcpUrl) {
      try {
        const parsed = new URL(lcpUrl);
        if (parsed.origin === origin) lcpImage = `${parsed.pathname}${parsed.search}`;
      } catch {
        // Ignore malformed performance entries.
      }
    }
    const links = collectLinks(hrefs, config.base, origin);

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
        statusCode,
        httpStatus: response?.status() ?? null,
        finalUrl,
        lcpImage,
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
      statusCode,
      httpStatus: response?.status() ?? null,
      finalUrl,
      lcpImage,
    };
  } catch (error) {
    error.retryable ??= isRetryableRenderError(error);
    if (tracing) {
      tracing = false;
      await context.tracing.stop({ path: traceFile }).then(
        () => {
          error.tracePath = traceFile;
        },
        // A failed trace must never replace the render error that explains the build failure.
        () => {},
      );
    }
    throw error;
  } finally {
    tracker.stop();
    if (tracing) await context.tracing.stop().catch(() => {});
    await context.close();
  }
}

// Navigation and network failures are transient; a bad selector or an HTTP status is not.
function isRetryableRenderError(error) {
  if (error?.name === 'TimeoutError') return true;
  return /net::ERR_|timed? ?out|ECONNRESET|ECONNREFUSED|socket hang up/i.test(error?.message ?? '');
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
  await page.evaluate((fallback) => {
    document.querySelectorAll('script[data-snappy-meta]').forEach((script) => script.remove());
    const current = typeof window === 'undefined' ? null : window.__SNAPPY_META__;
    const recorded = typeof window === 'undefined' ? null : window.__snappyHeadOriginals;
    const merged = { ...(current ?? fallback) };
    if (recorded) merged.originals = recorded;
    const payload = Object.keys(merged).length > 0 ? merged : fallback;
    const escapes = {
      '<': '\\u003C',
      '>': '\\u003E',
      '/': '\\u002F',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    };
    const text = JSON.stringify(payload).replace(/[<>/\u2028\u2029]/g, (char) => escapes[char]);
    const script = document.createElement('script');
    script.setAttribute('type', 'application/json');
    script.setAttribute('data-snappy-meta', '');
    script.textContent = text;
    const first = document.scripts[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
  }, defaults);
}

/**
 * Collects same-origin link targets from the rendered page and converts them to
 * app-relative routes for the crawler. Off-origin links are ignored so external
 * URLs can never be mistaken for routes and written into the output directory.
 */
function collectLinks(hrefs, base, origin) {
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
  return [...new Set(routes)];
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
