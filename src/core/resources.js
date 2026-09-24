import { blockThirdPartyRequests } from './blocking.js';

/**
 * Watches one page's network traffic. Records every third-party origin for the
 * preconnect hints, records same-origin asset paths for the preload features,
 * captures JSON bodies when the AJAX cache is enabled, and optionally aborts
 * third-party requests when blocking is switched on.
 */
export function createResourceCollector({
  origin,
  base,
  allowedHosts = [],
  blockThirdParty = false,
  collectJson = false,
}) {
  const thirdPartyOrigins = new Set();
  const images = new Set();
  const scripts = new Set();
  const styles = new Set();
  const json = new Map();
  const pending = [];

  return {
    thirdPartyOrigins,
    images,
    scripts,
    styles,
    json,
    // Waits for in-flight JSON body reads so the cache is complete before injection.
    async settled() {
      await Promise.allSettled(pending);
    },
    async install(page) {
      page.on('request', (request) => {
        const parsed = parseUrl(request.url());
        if (!parsed) return;
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
        if (parsed.origin === origin) return;
        thirdPartyOrigins.add(parsed.origin);
      });

      if (blockThirdParty) {
        await blockThirdPartyRequests(page, origin, allowedHosts);
      }

      page.on('response', (response) => {
        const request = response.request();
        const url = request.url();
        const parsed = parseUrl(url);
        if (!parsed || parsed.origin !== origin) return;
        const path = toAppPath(url, base);
        if (!path) return;

        const resourceType = request.resourceType();
        if (resourceType === 'image') images.add(path);
        else if (resourceType === 'script') scripts.add(path);
        else if (resourceType === 'stylesheet') styles.add(path);
        else if (collectJson && isJson(response)) {
          const capture = response
            .json()
            .then((body) => {
              json.set(path, body);
            })
            .catch(() => {
              // A truncated or aborted response is simply not cached.
            });
          pending.push(capture);
        }
      });
    },
  };
}

/**
 * Converts an absolute URL to the app-relative path, keeping the query string so
 * cached responses stay addressable by the same key the app used.
 */
export function toAppPath(url, base) {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  let pathname = parsed.pathname;
  if (base !== '/') {
    const prefix = base.slice(0, -1);
    if (!pathname.startsWith(prefix)) return null;
    pathname = pathname.slice(prefix.length) || '/';
  }
  return `${pathname}${parsed.search}`;
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isJson(response) {
  const contentType = response.headers()['content-type'] ?? '';
  return contentType.includes('json');
}
