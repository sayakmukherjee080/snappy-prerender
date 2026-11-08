import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startApiServer } from '../api.mjs';
import { normalizeUrl } from '../checker.mjs';

let api;

/**
 * Returns a minimal successful checker payload for the API tests.
 * @param {string} value
 * @returns {Promise<object>}
 */
async function checkSite(value) {
  const target = normalizeUrl(value);
  return {
    target: target.href,
    page: {
      title: 'Example page',
      description: 'An example page.',
      canonical: target.href,
      robots: 'index,follow',
      h1Count: 1,
      status: 200,
      finalUrl: target.href,
      bytes: 100,
      og: {
        title: 'Example page',
        description: 'An example page.',
        image: 'https://example.com/og.png',
        url: target.href,
        type: 'website',
        siteName: 'Example',
      },
      twitter: { card: 'summary_large_image' },
    },
    llms: { url: `${target.origin}/llms.txt`, found: true, status: 200, bytes: 8, content: '# Ex' },
    checkedAt: new Date().toISOString(),
  };
}

before(async () => {
  api = await startApiServer({ port: 0, host: '127.0.0.1', checkSite });
});

after(async () => {
  await new Promise((resolve) => api?.server.close(resolve));
});

const ORIGIN = 'https://snappy-prerender.smoldev.com';

/**
 * Calls the API and returns status, headers and JSON body.
 * @param {string} path
 * @param {{ method?: string, headers?: Record<string, string>, origin?: string | null }} [options]
 */
async function call(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  const response = await fetch(`http://127.0.0.1:${api.port}${path}`, {
    method: options.method,
    headers,
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

describe('checker API', () => {
  it('answers a CORS preflight for the allowed origin', async () => {
    const response = await fetch(`http://127.0.0.1:${api.port}/api/check`, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  });

  it('rejects a request without the allowed origin', async () => {
    const { response, body } = await call('/api/check?url=example.com', { origin: null });
    assert.equal(response.status, 403);
    assert.equal(body.code, 'FORBIDDEN_ORIGIN');
  });

  it('rejects an untrusted origin', async () => {
    const { response, body } = await call('/api/check?url=example.com', {
      origin: 'https://evil.example',
    });
    assert.equal(response.status, 403);
    assert.equal(body.code, 'FORBIDDEN_ORIGIN');
  });

  it('rejects a preflight from an untrusted origin', async () => {
    const response = await fetch(`http://127.0.0.1:${api.port}/api/check`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  it('reports health without spending a rate-limit token', async () => {
    const { response, body } = await call('/health');
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
  });

  it('returns the checker envelope', async () => {
    const { response, body } = await call('/api/check?url=example.com');
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.page.title, 'Example page');
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
  });

  it('rejects a missing URL', async () => {
    const { response, body } = await call('/api/check');
    assert.equal(response.status, 400);
    assert.equal(body.code, 'URL_REQUIRED');
  });

  it('rejects a private address', async () => {
    const { response, body } = await call('/api/check?url=http%3A%2F%2F127.0.0.1');
    assert.equal(response.status, 403);
    assert.equal(body.code, 'PRIVATE_ADDRESS');
  });

  it('returns 404 for unknown paths', async () => {
    const { response, body } = await call('/nope');
    assert.equal(response.status, 404);
    assert.equal(body.code, 'NOT_FOUND');
  });

  it('limits the API to 10 requests per second', async () => {
    let limited = 0;
    for (let index = 0; index < 30; index += 1) {
      const { response } = await call('/api/check?url=example.com');
      if (response.status === 429) limited += 1;
    }
    assert.ok(limited > 0, 'expected at least one 429 response');
  });
});
