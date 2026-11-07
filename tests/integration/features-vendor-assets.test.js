import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { launchBrowser } from '../../src/core/browser.js';
import { resolveConfig } from '../../src/core/config.js';
import { prerender } from '../../src/core/index.js';
import { startStaticServer } from '../../src/core/server.js';
import { cleanup, makeStaticSite } from './support.js';

const servers = [];
const cacheDirs = [];
const outputDirs = [];
after(async () => {
  for (const server of servers) await new Promise((resolve) => server.close(resolve));
  for (const dir of cacheDirs) await fs.rm(dir, { recursive: true, force: true });
  for (const dir of outputDirs) await fs.rm(dir, { recursive: true, force: true });
  await cleanup();
});

async function cachePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-vendor-cache-'));
  cacheDirs.push(dir);
  return path.join(dir, 'cache.json');
}

async function outputDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-vendor-out-'));
  outputDirs.push(dir);
  return dir;
}

function startCdn() {
  const state = {
    style:
      '@import "/imported.css"; @font-face { font-family: X; src: url("/font.woff2") format("woff2"); } body { background: url("/bg.png"); }',
    redirect: null,
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/style.css') {
      response.setHeader('content-type', 'text/css');
      response.end(state.style);
      return;
    }
    if (url.pathname === '/imported.css') {
      response.setHeader('content-type', 'text/css');
      response.end('.imported { color: red; }');
      return;
    }
    if (url.pathname === '/font.woff2') {
      response.setHeader('content-type', 'font/woff2');
      response.end('font-bytes');
      return;
    }
    if (url.pathname === '/bg.png') {
      response.setHeader('content-type', 'image/png');
      response.end('png-bytes');
      return;
    }
    if (url.pathname === '/app.js') {
      response.setHeader('content-type', 'application/javascript');
      response.end('console.log("vendor");');
      return;
    }
    if (url.pathname === '/wrong.css') {
      response.setHeader('content-type', 'text/plain');
      response.end('.wrong { color: red; }');
      return;
    }
    if (url.pathname === '/big.png') {
      response.setHeader('content-type', 'image/png');
      response.end('x'.repeat(64));
      return;
    }
    if (url.pathname === '/redirect.css' && state.redirect) {
      response.statusCode = 302;
      response.setHeader('location', state.redirect);
      response.end();
      return;
    }
    response.statusCode = 404;
    response.end('missing');
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}`, state });
    });
  });
}

function vendorPage(origin) {
  return `<!doctype html><html><head><title>Vendor</title><link rel="stylesheet" href="${origin}/style.css"></head><body><h1>Vendor</h1><img src="${origin}/bg.png" alt=""><img srcset="${origin}/bg.png 2x" src="${origin}/bg.png" alt=""><script src="${origin}/app.js" integrity="sha256-J5cfjEjYmICWbOz9e/G1AsjJBZkaQ+2FX9JcZYkLD4I="></script></body></html>`;
}

function options(sourceDir, host, overrides = {}) {
  return {
    sourceDir,
    include: ['/'],
    crawl: false,
    verify: false,
    audit: false,
    logLevel: 'silent',
    captureFormState: false,
    captureRuntimeStyles: false,
    vendorAssets: {
      hosts: [host],
      types: ['css', 'font', 'image', 'script'],
      failOnExternalAssets: true,
    },
    ...overrides,
  };
}

describe('prerender integration: asset localization', () => {
  it('downloads CSS, fonts, images and scripts and rewrites the page', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({ 'index.html': vendorPage(cdn.origin) });
    const destination = await outputDir();

    const report = await prerender(options(sourceDir, cdn.host, { destination }));
    assert.equal(report.ok, true);
    assert.equal(report.assets.bundled, 5);
    assert.equal(report.assets.externalRemaining.length, 0);

    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.equal(html.includes(cdn.origin), false);
    assert.match(html, /snappy-assets\/[a-f0-9]+\.css/);
    assert.match(html, /snappy-assets\/[a-f0-9]+\.js/);
    assert.match(html, /integrity="sha256-J5cfjEjYmICWbOz9e\/G1AsjJBZkaQ\+2FX9JcZYkLD4I="/);

    const manifest = JSON.parse(
      await fs.readFile(path.join(destination, 'snappy-assets', 'manifest.json'), 'utf8'),
    );
    assert.equal(manifest.length, 5);
    assert.equal(
      manifest.some((entry) => entry.type === 'font'),
      true,
    );
    assert.equal(
      manifest.some((entry) => entry.type === 'image'),
      true,
    );

    const cssEntry = manifest.find((entry) => entry.type === 'css' && entry.bytes > 30);
    const css = await fs.readFile(path.join(destination, cssEntry.local), 'utf8');
    assert.equal(css.includes(cdn.origin), false);
    assert.match(css, /snappy-assets\/[a-f0-9]+\.woff2/);
    assert.match(css, /snappy-assets\/[a-f0-9]+\.png/);
    assert.match(css, /@import ".*snappy-assets\/[a-f0-9]+\.css"/);
  });

  it('reuses vendored assets until the external asset changes', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({ 'index.html': vendorPage(cdn.origin) });
    const firstDestination = await outputDir();
    const secondDestination = await outputDir();
    const thirdDestination = await outputDir();
    const cache = await cachePath();
    const optionsWithCache = (destination, overrides = {}) => ({
      ...options(sourceDir, cdn.host, { destination }),
      incremental: { cachePath: cache },
      ...overrides,
    });

    const first = await prerender(optionsWithCache(firstDestination));
    assert.equal(first.routeDetails[0].status, 'written');
    assert.equal(first.assets.bundled, 5);

    const second = await prerender(optionsWithCache(secondDestination));
    assert.equal(second.routeDetails[0].status, 'cached');
    assert.equal(second.assets.bundled, 5);
    assert.equal(second.incremental.revalidated, 5);
    await fs.stat(path.join(secondDestination, 'snappy-assets', 'manifest.json'));

    cdn.state.style =
      '@font-face { font-family: X; src: url("/font.woff2"); } body { color: red; }';
    const third = await prerender(optionsWithCache(thirdDestination));
    assert.equal(third.routeDetails[0].status, 'written');
    assert.equal(
      third.incremental.invalidated.some((entry) => entry.reason === 'vendor-asset'),
      true,
    );
    assert.equal(third.assets.bundled, 4);
  });

  it('writes a shared vendored asset once across concurrent routes', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({
      'index.html': vendorPage(cdn.origin),
      'about/index.html': vendorPage(cdn.origin),
    });
    const destination = await outputDir();
    const report = await prerender({
      ...options(sourceDir, cdn.host, { destination, include: ['/', '/about'] }),
      vendorAssets: {
        hosts: [cdn.host],
        types: ['css', 'font', 'image', 'script'],
        onError: 'fail',
      },
      concurrency: 8,
    });
    assert.equal(report.ok, true);
    assert.equal(report.assets.bundled, 5);
    assert.equal(report.errors.length, 0);
    assert.equal(report.files.filter((file) => file.file.startsWith('snappy-assets/')).length, 6);
  });

  it('inlines localized vendor CSS and still reuses the route', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({ 'index.html': vendorPage(cdn.origin) });
    const firstDestination = await outputDir();
    const secondDestination = await outputDir();
    const cache = await cachePath();
    const optionsWithCache = (destination) => ({
      ...options(sourceDir, cdn.host, {
        destination,
        inlineCss: 'inline',
        vendorAssets: {
          hosts: [cdn.host],
          types: ['css', 'font', 'image', 'script'],
          onError: 'fail',
        },
      }),
      incremental: { cachePath: cache },
    });
    const first = await prerender(optionsWithCache(firstDestination));
    const second = await prerender(optionsWithCache(secondDestination));
    assert.equal(first.ok, true);
    assert.equal(second.routeDetails[0].status, 'cached');
    const html = await fs.readFile(path.join(secondDestination, 'index.html'), 'utf8');
    assert.match(html, /<style data-snappy-inline="">/);
    assert.equal(html.includes('rel="stylesheet"'), false);
    assert.equal(html.includes(cdn.origin), false);
    assert.match(html, /\/snappy-assets\/[a-f0-9]+\.woff2/);
    assert.match(html, /\/snappy-assets\/[a-f0-9]+\.png/);
  });

  it('does not cache a route whose vendored asset failed in warn mode', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Missing</title></head><body><h1>Missing</h1><img src="${cdn.origin}/missing.png" alt=""></body></html>`,
    });
    const firstDestination = await outputDir();
    const secondDestination = await outputDir();
    const cache = await cachePath();
    const optionsWithCache = (destination) => ({
      ...options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: [cdn.host],
          types: ['image'],
          onError: 'warn',
        },
      }),
      incremental: { cachePath: cache },
    });
    const first = await prerender(optionsWithCache(firstDestination));
    const second = await prerender(optionsWithCache(secondDestination));
    assert.notEqual(first.routeDetails[0].status, 'cached');
    assert.notEqual(second.routeDetails[0].status, 'cached');
  });

  it('keeps an asset with a mismatched SRI external and out of the cache', async () => {
    const cdn = await startCdn();
    const integrity = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>SRI</title></head><body><h1>SRI</h1><script src="${cdn.origin}/app.js" integrity="${integrity}"></script></body></html>`,
    });
    const firstDestination = await outputDir();
    const secondDestination = await outputDir();
    const cache = await cachePath();
    const optionsWithCache = (destination) => ({
      ...options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: [cdn.host],
          types: ['script'],
          onError: 'warn',
        },
      }),
      incremental: { cachePath: cache },
    });
    const first = await prerender(optionsWithCache(firstDestination));
    const second = await prerender(optionsWithCache(secondDestination));
    assert.equal(first.assets.failed, 1);
    assert.notEqual(first.routeDetails[0].status, 'cached');
    assert.notEqual(second.routeDetails[0].status, 'cached');
    const html = await fs.readFile(path.join(secondDestination, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`${cdn.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/app\\.js`));
    assert.equal(html.includes('snappy-assets/'), false);

    const server = await startStaticServer({ dir: secondDestination, base: '/' });
    const { browser } = await launchBrowser(resolveConfig({ logLevel: 'silent' }), {
      info() {},
      warn() {},
      error() {},
      debug() {},
    });
    try {
      const context = await browser.newContext({ javaScriptEnabled: true });
      const page = await context.newPage();
      const messages = [];
      page.on('console', (message) => messages.push(message.text()));
      await page.goto(`${server.origin}/`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(250);
      assert.equal(
        messages.some((message) => /integrity/i.test(message)),
        true,
      );
      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  });

  it('keeps a private host external even when a wildcard allowlist would match it', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Private</title><link rel="stylesheet" href="${cdn.origin}/style.css"></head><body><h1>Private</h1></body></html>`,
    });
    const destination = await outputDir();
    const report = await prerender(
      options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: ['*.0.0.1'],
          types: ['css'],
          failOnExternalAssets: true,
        },
      }),
    );
    assert.equal(report.ok, false);
    assert.equal(report.assets.skipped, 1);
    assert.equal(report.assets.externalRemaining[0], `${cdn.origin}/style.css`);
    assert.equal(
      report.errors.some((error) => error.message.includes('external')),
      true,
    );
  });

  it('rejects wrong content types, oversized assets and redirects outside the allowlist', async () => {
    const cdn = await startCdn();
    const target = http.createServer((_request, response) => {
      response.setHeader('content-type', 'text/css');
      response.end('.private { color: red; }');
    });
    servers.push(target);
    await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
    cdn.state.redirect = `http://127.0.0.1:${target.address().port}/private.css`;
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Security</title><link rel="stylesheet" href="${cdn.origin}/wrong.css"><link rel="stylesheet" href="${cdn.origin}/redirect.css"></head><body><h1>Security</h1><img src="${cdn.origin}/big.png" alt=""></body></html>`,
    });
    const destination = await outputDir();
    const report = await prerender(
      options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: [cdn.host],
          types: ['css', 'image'],
          maxBytes: 32,
          onError: 'warn',
        },
      }),
    );
    assert.equal(report.ok, true);
    assert.equal(report.assets.failed, 3);
    assert.deepEqual(report.assets.externalRemaining, [
      `${cdn.origin}/big.png`,
      `${cdn.origin}/redirect.css`,
      `${cdn.origin}/wrong.css`,
    ]);
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.match(html, /wrong\.css/);
    assert.match(html, /redirect\.css/);
    assert.match(html, /big\.png/);
    assert.equal(html.includes('snappy-assets/'), false);
  });

  it('fails the route when onError is fail and SRI does not match', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>SRI fail</title></head><body><h1>SRI fail</h1><script src="${cdn.origin}/app.js" integrity="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="></script></body></html>`,
    });
    const destination = await outputDir();
    const report = await prerender(
      options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: [cdn.host],
          types: ['script'],
          onError: 'fail',
        },
      }),
    );
    assert.equal(report.ok, false);
    assert.equal(
      report.errors.some((error) => /Subresource Integrity/.test(error.message)),
      true,
    );
  });

  it('fails the build when onError is fail and a download is missing', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Missing</title></head><body><h1>Missing</h1><img src="${cdn.origin}/missing.png" alt=""></body></html>`,
    });
    const destination = await outputDir();
    const report = await prerender(
      options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: [cdn.host],
          types: ['image'],
          onError: 'fail',
        },
      }),
    );
    assert.equal(report.ok, false);
    assert.equal(
      report.errors.some((error) => error.message.includes('could not download')),
      true,
    );
  });

  it('leaves disallowed asset types external and fails the self-contained gate', async () => {
    const cdn = await startCdn();
    const sourceDir = await makeStaticSite({ 'index.html': vendorPage(cdn.origin) });
    const destination = await outputDir();
    const report = await prerender(
      options(sourceDir, cdn.host, {
        destination,
        vendorAssets: {
          hosts: [cdn.host],
          types: ['css', 'font', 'image'],
          failOnExternalAssets: true,
        },
      }),
    );
    assert.equal(report.ok, false);
    assert.equal(
      report.assets.externalRemaining.some((url) => url.endsWith('/app.js')),
      true,
    );
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.equal(html.includes(`${cdn.origin}/app.js`), true);
  });
});
