import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { normalizeUrl } from '../checker.mjs';
import { startDemoServer } from '../server.mjs';

let demo;
let root;

/**
 * Builds the fake checker response used by the HTTP tests.
 * @param {string} value
 * @returns {Promise<object>}
 */
async function checkSite(value) {
  const target = normalizeUrl(value);
  return {
    target: target.href,
    page: {
      title: 'Example page',
      description: 'An example page for the checker test.',
      canonical: target.href,
      robots: 'index,follow',
      lang: 'en',
      h1Count: 1,
      textLength: 120,
      status: 200,
      finalUrl: target.href,
      bytes: 2400,
      og: {
        title: 'Example page',
        description: 'An example page for the checker test.',
        image: 'https://example.com/og.png',
        url: target.href,
        type: 'website',
        siteName: 'Example',
      },
      twitter: { card: 'summary_large_image', title: null, description: null, image: null },
    },
    llms: {
      url: `${target.origin}/llms.txt`,
      found: true,
      status: 200,
      bytes: 12,
      content: '# Example',
    },
    checkedAt: new Date().toISOString(),
  };
}

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-demo-server-'));
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>Demo</title>');
  await fs.mkdir(path.join(root, 'after'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'after', '404.html'),
    '<!doctype html><title>Not found</title>',
  );
  demo = await startDemoServer({ root, port: 0, checkSite });
});

after(async () => {
  await demo?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

/**
 * Calls the check endpoint and returns its status, JSON body and headers.
 * @param {string} search
 * @param {{ method?: string, headers?: Record<string, string> }} [options]
 */
async function call(search, options = {}) {
  const response = await fetch(`${demo.origin}/api/check${search}`, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

describe('GET /api/check', () => {
  it('returns the checker envelope for a public URL', async () => {
    const { response, body } = await call('?url=example.com');
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.target, 'https://example.com/');
    assert.equal(body.data.page.title, 'Example page');
    assert.equal(body.data.llms.found, true);
    assert.ok(response.headers.get('x-request-id'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('rejects a missing URL', async () => {
    const { response, body } = await call('');
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.code, 'URL_REQUIRED');
  });

  it('rejects a malformed URL', async () => {
    const { response, body } = await call('?url=not%20a%20url');
    assert.equal(response.status, 400);
    assert.equal(body.code, 'INVALID_URL');
  });

  it('rejects a non-web protocol', async () => {
    const { response, body } = await call('?url=ftp%3A%2F%2Fexample.com');
    assert.equal(response.status, 400);
    assert.equal(body.code, 'INVALID_PROTOCOL');
  });

  it('rejects a private address without fetching it', async () => {
    const { response, body } = await call('?url=http%3A%2F%2F127.0.0.1');
    assert.equal(response.status, 403);
    assert.equal(body.code, 'PRIVATE_ADDRESS');
  });

  it('rejects an oversized URL', async () => {
    const { response, body } = await call(`?url=${'a'.repeat(3000)}`);
    assert.equal(response.status, 400);
    assert.equal(body.code, 'URL_TOO_LONG');
  });

  it('allows only GET', async () => {
    const { response, body } = await call('', { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(body.code, 'METHOD_NOT_ALLOWED');
    assert.equal(response.headers.get('allow'), 'GET');
  });

  it('rate limits one caller after twenty checks', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.7' };
    for (let index = 0; index < 20; index += 1) {
      const { response } = await call('?url=example.com', { headers });
      assert.equal(response.status, 200);
    }
    const { response, body } = await call('?url=example.com', { headers });
    assert.equal(response.status, 429);
    assert.equal(body.code, 'RATE_LIMITED');
  });
});

describe('static serving', () => {
  it('serves the generated 404 document for an unknown after route', async () => {
    const response = await fetch(`${demo.origin}/after/does-not-exist`);
    assert.equal(response.status, 404);
    assert.match(await response.text(), /Not found/);
  });
});
