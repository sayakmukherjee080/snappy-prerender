import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { launchBrowser } from '../../src/core/browser.js';
import { resolveConfig } from '../../src/core/config.js';
import { prerender } from '../../src/core/index.js';
import { createLogger } from '../../src/core/log.js';
import { verifyRoutes } from '../../src/core/verify.js';
import { cleanup, makeStaticSite } from './support.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, '..', 'fixtures');

after(cleanup);

describe('prerender integration: framework detection and mismatch locator', () => {
  let sourceDir;

  before(async () => {
    const root = path.join(fixtureRoot, 'react19-app');
    sourceDir = await makeStaticSite({});
    await build({ root, logLevel: 'silent', build: { outDir: sourceDir, emptyOutDir: true } });
  });

  it('reports the detected framework and hydrated mode', async () => {
    const report = await prerender({
      sourceDir,
      include: ['/head'],
      verify: true,
      audit: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    const entry = report.verification.routes.find((route) => route.route === '/head');
    assert.equal(entry.framework, 'react');
    assert.equal(entry.mode, 'hydrated');
    assert.equal(entry.firstMismatch, null);
    assert.deepEqual(report.verification.frameworks, { react: 1 });
  });

  it('locates the first mismatch on a re-rendering route', async () => {
    const report = await prerender({
      sourceDir,
      include: ['/mismatch'],
      verify: true,
      audit: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    const entry = report.verification.routes.find((route) => route.route === '/mismatch');
    assert.equal(entry.mode, 're-rendered');
    assert.ok(entry.firstMismatch);
    assert.equal(entry.firstMismatch.kind, 'text');
    assert.match(entry.firstMismatch.path, />h1$/);
    const detail = report.routeDetails.find((route) => route.route === '/mismatch');
    assert.deepEqual(detail.firstMismatch, entry.firstMismatch);
  });

  it('detects a Vue marker and classifies its mismatch message', async () => {
    const staticDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Vue page</title></head><body>
        <div id="root"><h1>Vue page</h1></div>
        <script>
          document.querySelector('#root').__vue_app__ = {};
          console.error('Hydration node mismatch');
        </script>
      </body></html>`,
    });
    const report = await prerender({
      sourceDir: staticDir,
      include: ['/'],
      verify: true,
      audit: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    const entry = report.verification.routes.find((route) => route.route === '/');
    assert.equal(entry.framework, 'vue');
    assert.equal(entry.mode, 'hydrated');
    assert.deepEqual(entry.hydrationErrors, ['Hydration node mismatch']);
    assert.deepEqual(report.verification.frameworks, { vue: 1 });
  });

  it('honours an explicit framework choice', async () => {
    const staticDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Vue page</title></head><body>
        <div id="root"><h1>Vue page</h1></div>
        <script>
          document.querySelector('#root').__vue_app__ = {};
          console.error('Text content did not match server-rendered HTML');
        </script>
      </body></html>`,
    });
    const report = await prerender({
      sourceDir: staticDir,
      include: ['/'],
      framework: 'vue',
      verify: true,
      audit: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    const entry = report.verification.routes.find((route) => route.route === '/');
    assert.equal(entry.framework, 'vue');
    assert.equal(entry.mode, 'hydrated');
    assert.deepEqual(entry.hydrationErrors, []);
    assert.equal(entry.consoleErrors.length, 1);
  });

  it('reuses verification contexts when requested', async () => {
    const staticDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home</title></head><body><h1>Home</h1><a href="/about">About</a></body></html>',
      'about/index.html':
        '<!doctype html><html><head><title>About</title></head><body><h1>About</h1></body></html>',
    });
    const report = await prerender({
      sourceDir: staticDir,
      include: ['/', '/about'],
      verify: true,
      reuseVerificationContext: true,
      audit: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    assert.equal(report.verification.routes.length, 2);
    assert.equal(report.verification.errors.length, 0);
  });

  it('accepts HTTP 404 for the configured not-found route during verification', async () => {
    const outputDir = await makeStaticSite({
      '404.html':
        '<!doctype html><html><head><title>Not found</title><meta name="prerender-status-code" content="404"></head><body><h1>Not found</h1></body></html>',
    });
    const server = http.createServer((request, response) => {
      if (request.url === '/404') {
        response.statusCode = 404;
        response.setHeader('content-type', 'text/html');
        response.end(
          '<!doctype html><html><head><title>Not found</title><meta name="prerender-status-code" content="404"></head><body><h1>Not found</h1></body></html>',
        );
        return;
      }
      response.setHeader('content-type', 'text/html');
      response.end(
        '<!doctype html><html><head><title>Home</title></head><body><h1>Home</h1></body></html>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const log = createLogger('silent');
    const { browser } = await launchBrowser(resolveConfig({ logLevel: 'silent' }), log);
    try {
      const verification = await verifyRoutes({
        browser,
        origin: `http://127.0.0.1:${server.address().port}`,
        routes: ['/404'],
        config: resolveConfig({ notFoundRoute: '/404', logLevel: 'silent' }),
        outputDir,
      });
      const entry = verification.routes.find((route) => route.route === '/404');
      assert.equal(entry.status, 404);
      assert.equal(entry.notFound, true);
      assert.equal(entry.ok, true);
    } finally {
      await browser.close();
      await new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      });
    }
  });
});
