import { createHash } from 'node:crypto';
import { blockThirdPartyRequests } from './blocking.js';
import { dataRequestKey } from './revalidate.js';

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
  maxCachedBytes = Number.POSITIVE_INFINITY,
  recordData = false,
  dataMaxBytes = 5 * 1024 * 1024,
}) {
  const thirdPartyOrigins = new Set();
  const images = new Set();
  const scripts = new Set();
  const styles = new Set();
  const fonts = new Map();
  const json = new Map();
  const dataRequests = [];
  const dataByRequest = new WeakMap();
  const pending = [];
  const dataPending = [];

  return {
    thirdPartyOrigins,
    images,
    scripts,
    styles,
    fonts,
    json,
    dataRequests,
    // Waits for in-flight JSON and data body reads so the cache is complete.
    async settled() {
      await Promise.allSettled([...pending, ...dataPending]);
    },
    async install(page) {
      page.on('request', (request) => {
        const parsed = parseUrl(request.url());
        if (!parsed) return;
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
        if (recordData && isDataRequest(request)) {
          const headers = request.headers();
          const record = {
            method: request.method(),
            url: request.url(),
            sameOrigin: parsed.origin === origin,
            accept: headers.accept ?? '',
            requestContentType: headers['content-type'] ?? '',
            status: null,
            etag: null,
            lastModified: null,
            bodyHash: null,
            bytes: 0,
            unverifiable: false,
            reason: null,
          };
          record.key = dataRequestKey(record);
          if (record.method !== 'GET' && record.method !== 'HEAD') {
            record.unverifiable = true;
            record.reason = `${record.method} requests are not replayed`;
          } else if (headers.authorization) {
            record.unverifiable = true;
            record.reason = 'the request used an Authorization header';
          } else if (record.method === 'HEAD') {
            record.unverifiable = true;
            record.reason = 'HEAD responses do not expose a body hash';
          }
          dataByRequest.set(request, record);
          dataRequests.push(record);
        }
        if (parsed.origin === origin) return;
        thirdPartyOrigins.add(parsed.origin);
      });

      if (blockThirdParty) {
        await blockThirdPartyRequests(page, origin, allowedHosts);
      }

      page.on('requestfailed', (request) => {
        const record = dataByRequest.get(request);
        if (!record) return;
        record.unverifiable = true;
        record.reason = `request failed: ${request.failure()?.errorText ?? 'unknown error'}`;
      });

      page.on('response', (response) => {
        const request = response.request();
        const dataRecord = dataByRequest.get(request);
        if (dataRecord) recordDataResponse(response, dataRecord, dataPending, dataMaxBytes);
        const url = request.url();
        const parsed = parseUrl(url);
        if (!parsed || parsed.origin !== origin) return;
        if (response.status() >= 400) return;
        const path = toAppPath(url, base);
        if (!path) return;

        const resourceType = request.resourceType();
        if (resourceType === 'image') images.add(path);
        else if (resourceType === 'script') scripts.add(path);
        else if (resourceType === 'stylesheet') styles.add(path);
        else if (resourceType === 'font') {
          fonts.set(path, response.headers()['content-type'] ?? null);
        } else if (collectJson && isJson(response)) {
          const length = Number(response.headers()['content-length'] ?? Number.NaN);
          if (Number.isFinite(length) && length > maxCachedBytes) return;
          const capture = response
            .json()
            .then((body) => {
              if (withinCacheLimit(body, maxCachedBytes)) json.set(path, body);
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
    if (pathname === prefix) pathname = '/';
    else if (pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length);
    else return null;
  }
  return `${pathname}${parsed.search}`;
}

/**
 * Reports whether a captured JSON body fits the cache budget, measured on the serialised
 * text so the check matches how much is injected into the page.
 */
export function withinCacheLimit(body, maxBytes) {
  return JSON.stringify(body).length <= maxBytes;
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

// Reports whether a request carries application data rather than an asset.
function isDataRequest(request) {
  const type = request.resourceType();
  return type === 'xhr' || type === 'fetch';
}

// Records a data response's status and body hash, or marks it unverifiable when the
// body cannot be replayed. The body is never stored in the cache.
function recordDataResponse(response, record, pending, maxBytes) {
  record.status = response.status();
  const headers = response.headers();
  record.etag = headers.etag ?? null;
  record.lastModified = headers['last-modified'] ?? null;
  if (record.status >= 400) {
    record.unverifiable = true;
    record.reason = `response returned HTTP ${record.status}`;
    return;
  }
  if (record.method === 'HEAD') return;
  const length = Number(headers['content-length'] ?? Number.NaN);
  if (Number.isFinite(length) && length > maxBytes) {
    record.unverifiable = true;
    record.reason = `response is larger than the revalidation limit (${length} bytes)`;
    return;
  }
  const capture = response
    .body()
    .then((body) => {
      if (body.length > maxBytes) {
        record.unverifiable = true;
        record.reason = `response is larger than the revalidation limit (${body.length} bytes)`;
        return;
      }
      record.bodyHash = createHash('sha256').update(body).digest('hex');
      record.bytes = body.length;
    })
    .catch((error) => {
      record.unverifiable = true;
      record.reason = `body read failed: ${error.message}`;
    });
  pending.push(capture);
}

function isJson(response) {
  const contentType = response.headers()['content-type'] ?? '';
  return contentType.includes('json');
}
