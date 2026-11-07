import { createHash } from 'node:crypto';
import { request as playwrightRequest } from 'playwright-core';

/**
 * Revalidates the GET requests a route made during the previous render without opening
 * the app. Each unique request is fetched once, with conditional headers when the
 * previous response supplied them. A route may reuse cached HTML only when every data
 * response still matches.
 */
export class DataRevalidator {
  /**
   * @param {{ config: object, origin: string, log: object }} options
   */
  constructor({ config, origin, log }) {
    this.config = config;
    this.origin = origin;
    this.log = log;
    this.context = null;
    this.results = new Map();
    this.pending = new Map();
  }

  /**
   * Validates one route's recorded request list. Duplicate requests share one fetch.
   * @param {object[]} requests
   * @returns {Promise<{ ok: boolean, reason?: string, results: object[] }>}
   */
  async validate(requests) {
    if (requests.length === 0) return { ok: true, results: [] };
    for (const record of requests) {
      if (record.unverifiable) {
        return {
          ok: false,
          reason: record.reason ?? 'a data request cannot be revalidated safely',
          results: [],
        };
      }
    }
    const unique = new Map();
    for (const record of requests) {
      const existing = unique.get(record.key);
      if (existing && existing.bodyHash !== record.bodyHash) {
        return {
          ok: false,
          reason: 'the same request returned different data during one render',
          results: [],
        };
      }
      if (!existing) unique.set(record.key, record);
    }
    const results = await Promise.all([...unique.values()].map((record) => this.check(record)));
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      return {
        ok: false,
        reason: failed[0].reason,
        results,
      };
    }
    return { ok: true, results };
  }

  /**
   * Checks one unique request, sharing an in-flight promise with other routes.
   * @param {object} record
   * @returns {Promise<object>}
   */
  check(record) {
    if (this.results.has(record.key)) return Promise.resolve(this.results.get(record.key));
    if (this.pending.has(record.key)) return this.pending.get(record.key);
    const promise = this.fetch(record)
      .then((result) => {
        this.results.set(record.key, result);
        return result;
      })
      .finally(() => {
        this.pending.delete(record.key);
      });
    this.pending.set(record.key, promise);
    return promise;
  }

  /**
   * Fetches one request and compares its response hash with the recorded one.
   * @param {object} record
   * @returns {Promise<object>}
   */
  async fetch(record) {
    if (record.method !== 'GET' && record.method !== 'HEAD') {
      return { key: record.key, ok: false, reason: `cannot replay ${record.method}` };
    }
    const url = this.targetUrl(record);
    if (!url) {
      return { key: record.key, ok: false, reason: 'the recorded request URL is invalid' };
    }
    if (!this.hostAllowed(url, record.sameOrigin)) {
      return {
        key: record.key,
        ok: false,
        reason: `${url.hostname} is outside incremental.data.hosts`,
      };
    }
    let response;
    try {
      this.context ??= await playwrightRequest.newContext({
        storageState: this.config.storageState ?? undefined,
        userAgent: this.config.userAgent ?? undefined,
        ignoreHTTPSErrors: this.config.ignoreHTTPSErrors,
        timeout: this.config.timeout,
        maxRedirects: 5,
      });
      response = await this.context.fetch(url.href, {
        method: record.method,
        headers: this.requestHeaders(record),
        timeout: this.config.timeout,
        failOnStatusCode: false,
      });
    } catch (error) {
      return { key: record.key, ok: false, reason: `request failed: ${error.message}` };
    }
    if (response.status() === 304) return { key: record.key, ok: true, status: 304 };
    if (response.status() < 200 || response.status() >= 300) {
      return {
        key: record.key,
        ok: false,
        reason: `responded with HTTP ${response.status()}`,
      };
    }
    let body;
    try {
      body = await response.body();
    } catch (error) {
      return { key: record.key, ok: false, reason: `body read failed: ${error.message}` };
    }
    if (body.length > this.config.incremental.data.maxBytes) {
      return {
        key: record.key,
        ok: false,
        reason: `response is larger than incremental.data.maxBytes (${body.length} bytes)`,
      };
    }
    const bodyHash = createHash('sha256').update(body).digest('hex');
    if (record.method === 'HEAD') {
      return { key: record.key, ok: bodyHash === record.bodyHash, status: response.status() };
    }
    if (bodyHash !== record.bodyHash) {
      return {
        key: record.key,
        ok: false,
        reason: 'the response body changed',
        status: response.status(),
      };
    }
    return { key: record.key, ok: true, status: response.status() };
  }

  /**
   * Resolves a recorded URL against the current server origin for same-origin requests.
   * @param {object} record
   * @returns {URL | null}
   */
  targetUrl(record) {
    try {
      const url = new URL(record.url);
      if (record.sameOrigin) {
        return new URL(`${url.pathname}${url.search}${url.hash}`, this.origin);
      }
      return url;
    } catch {
      return null;
    }
  }

  /**
   * Applies incremental.data.hosts to third-party requests. Same-origin requests are
   * always the app's own data.
   * @param {URL} url
   * @param {boolean} sameOrigin
   * @returns {boolean}
   */
  hostAllowed(url, sameOrigin) {
    if (sameOrigin) return true;
    if (this.config.incremental.data.hosts.length === 0) return true;
    const hosts = [
      ...this.config.incremental.data.hosts,
      ...(this.config.vendorAssets?.enabled ? this.config.vendorAssets.hosts : []),
    ];
    const host = url.hostname.toLowerCase();
    const withPort = url.port ? `${host}:${url.port}` : host;
    return hosts.some((entry) => {
      const value = String(entry).trim().toLowerCase();
      if (!value) return false;
      if (value === withPort || value === host) return true;
      if (value.startsWith('*.')) {
        const suffix = value.slice(1);
        return host.endsWith(suffix) && host !== value.slice(2);
      }
      return false;
    });
  }

  /**
   * Builds the replay headers. Secret request headers are never stored; requests that
   * had an Authorization header are marked unverifiable by the collector.
   * @param {object} record
   * @returns {object}
   */
  requestHeaders(record) {
    const headers = {};
    if (record.accept) headers.accept = record.accept;
    if (record.requestContentType) headers['content-type'] = record.requestContentType;
    if (record.etag) headers['if-none-match'] = record.etag;
    if (record.lastModified) headers['if-modified-since'] = record.lastModified;
    return headers;
  }

  /**
   * Releases the request context. Safe to call more than once.
   */
  async close() {
    if (this.context) {
      await this.context.dispose().catch(() => {});
      this.context = null;
    }
  }
}

/**
 * Normalises a recorded response hash and body length into one stable request key.
 * @param {{ method: string, url: string, accept?: string, requestContentType?: string }} input
 * @returns {string}
 */
export function dataRequestKey({ method, url, accept = '', requestContentType = '' }) {
  return `${method}|${url}|${accept}|${requestContentType}`;
}
