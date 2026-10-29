import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite, solidPng } from './support.js';

after(cleanup);

const base = {
  verify: false,
  audit: false,
  logLevel: 'silent',
  captureFormState: false,
  captureRuntimeStyles: false,
};

// A 400x400 PNG, so Chrome treats it as an LCP candidate. Tiny SVG and 1x1 images are not.
function hash(text) {
  return `sha256-${createHash('sha256').update(text).digest('base64')}`;
}

function policyOf(html) {
  return html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? null;
}

describe('prerender integration: CSP hash mode', () => {
  it('hashes inline scripts and styles and leaves JSON-LD alone', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>CSP page</title>
        <script type="application/ld+json">{"@context":"https://schema.org"}</script>
        <style>body { color: red }</style>
      </head><body><h1>CSP page</h1>
        <script>window.inlineRan = true;</script>
      </body></html>`,
    });
    const report = await prerender({ ...base, sourceDir, include: ['/'], csp: 'hash' });
    assert.equal(report.ok, true);
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    const policy = policyOf(html);
    assert.ok(policy);
    assert.equal(policy.includes(`'${hash('window.inlineRan = true;')}'`), true);
    assert.equal(policy.includes(`'${hash('body { color: red }')}'`), true);
    assert.equal(policy.includes(`'${hash('{"@context":"https://schema.org"}')}'`), false);
    assert.equal(policy.includes("'unsafe-inline'"), false);
    assert.equal(html.includes('application/ld+json'), true);
  });

  it('keeps an existing policy and warns instead of merging', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>CSP page</title>
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
      </head><body><h1>CSP page</h1></body></html>`,
    });
    const report = await prerender({ ...base, sourceDir, include: ['/'], csp: 'hash' });
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal((html.match(/Content-Security-Policy/g) ?? []).length, 1);
    assert.match(html, /content="default-src 'self'"/);
    assert.deepEqual(report.cspSkipped, ['/']);
  });
});

describe('prerender integration: static preload injection', () => {
  it('injects chunk, font and LCP image hints', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Assets</title>
        <style>
          @font-face { font-family: Fixture; src: url('/assets/fixture.woff2') format('woff2'); }
          body { font-family: Fixture, sans-serif; }
        </style>
      </head><body><h1>Assets</h1>
        <img src="/hero.png" width="400" height="400" alt="Hero">
        <script>import('/assets/chunk.js').catch(() => {});</script>
        <script src="/assets/app.js"></script>
      </body></html>`,
      'assets/fixture.woff2': 'not a real font, but the request is what matters',
      'assets/chunk.js': 'export const chunk = 1;',
      'assets/app.js': 'window.appLoaded = true;',
      'hero.png': solidPng(400, 400),
    });
    const report = await prerender({
      ...base,
      sourceDir,
      include: ['/'],
      preloadLinks: true,
    });
    assert.equal(report.ok, true);
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /rel="modulepreload" href="\/assets\/chunk\.js"/);
    assert.match(html, /rel="preload" as="font" href="\/assets\/fixture\.woff2"/);
    assert.match(html, /type="font\/woff2"/);
    assert.match(html, /rel="preload" as="image" href="\/hero\.png" fetchpriority="high"/);
    assert.equal(html.includes('modulepreload" href="/assets/app.js"'), false);
  });

  it('does not inject hints when the option is off', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Assets</title></head><body><h1>Assets</h1><script>import('/assets/chunk.js').catch(() => {});</script></body></html>`,
      'assets/chunk.js': 'export const chunk = 1;',
    });
    await prerender({ ...base, sourceDir, include: ['/'] });
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('modulepreload'), false);
  });

  it('does not preload scripts that removeScriptTags stripped', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Assets</title></head><body><h1>Assets</h1><script src="/assets/app.js"></script></body></html>`,
      'assets/app.js': 'window.appLoaded = true;',
    });
    await prerender({
      ...base,
      sourceDir,
      include: ['/'],
      preloadLinks: true,
      removeScriptTags: true,
    });
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('modulepreload'), false);
    assert.equal(html.includes('app.js'), false);
  });

  it('does not preload a script that transformHtml removed', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Assets</title></head><body><h1>Assets</h1><script src="/assets/app.js"></script></body></html>`,
      'assets/app.js': 'window.appLoaded = true;',
    });
    await prerender({
      ...base,
      sourceDir,
      include: ['/'],
      preloadLinks: true,
      transformHtml: (html) => html.replace(/<script[^>]*app\.js[^>]*><\/script>/, ''),
    });
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('modulepreload'), false);
    assert.equal(html.includes('app.js'), false);
  });
});

function startTestServer() {
  let failures = 0;
  let failMode = 'never';
  const server = http.createServer((request, response) => {
    const userAgent = request.headers['user-agent'] ?? '';
    const navigates = userAgent.includes('SnappyPrerender');
    const fail = navigates && (failMode === 'always' || (failMode === 'once' && failures === 0));
    if (fail) {
      failures += 1;
      response.statusCode = 500;
      response.end('temporary failure');
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(
      '<!doctype html><html><head><title>Retry</title></head><body><h1>Retry page</h1></body></html>',
    );
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        failOnce() {
          failMode = 'once';
        },
        failAlways() {
          failMode = 'always';
        },
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(done);
          }),
      });
    });
  });
}

function startNotFoundServer() {
  const server = http.createServer((request, response) => {
    if (request.url === '/404') {
      response.statusCode = 404;
      response.setHeader('content-type', 'text/html');
      response.end(
        '<!doctype html><html><head><title>Not found</title><meta name="prerender-status-code" content="404"></head><body><h1>Not found</h1></body></html>',
      );
      return;
    }
    if (request.url === '/other') {
      response.statusCode = 404;
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><html><head><title>Missing</title></head><body></body></html>');
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(
      '<!doctype html><html><head><title>Home</title></head><body><h1>Home</h1></body></html>',
    );
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(done);
          }),
      });
    });
  });
}

async function serveCommandOptions(server, destination, overrides = {}) {
  const holder = await makeStaticSite({ 'hold.mjs': 'setInterval(() => {}, 1000);\n' });
  return {
    ...base,
    sourceDir: holder,
    destination,
    serveCmd: `node ${path.join(holder, 'hold.mjs')}`,
    url: server.origin,
    include: ['/'],
    ...overrides,
  };
}

describe('prerender integration: not-found route', () => {
  it('accepts an HTTP 404 for the configured notFoundRoute and writes 404.html', async () => {
    const server = await startNotFoundServer();
    const destination = await makeStaticSite({});
    try {
      const report = await prerender(
        await serveCommandOptions(server, destination, {
          include: ['/404'],
          notFoundRoute: '/404',
        }),
      );
      assert.equal(report.ok, true);
      assert.deepEqual(report.notFoundRoutes, ['/404']);
      const detail = report.routeDetails.find((route) => route.route === '/404');
      assert.equal(detail.notFound, true);
      assert.equal(detail.httpStatus, 404);
      const html = await fs.readFile(path.join(destination, '404.html'), 'utf8');
      assert.match(html, /Not found/);
    } finally {
      await server.close();
    }
  });

  it('still fails a non-notFound route that returns HTTP 404', async () => {
    const server = await startNotFoundServer();
    const destination = await makeStaticSite({});
    try {
      const report = await prerender(
        await serveCommandOptions(server, destination, {
          include: ['/other'],
          notFoundRoute: '/404',
        }),
      );
      assert.equal(report.ok, false);
      assert.match(report.errors[0].message, /HTTP 404/);
    } finally {
      await server.close();
    }
  });
});

describe('prerender integration: retries and diagnostics', () => {
  it('retries a transient failure and succeeds', async () => {
    const server = await startTestServer();
    server.failOnce();
    const destination = await makeStaticSite({});
    try {
      const report = await prerender(
        await serveCommandOptions(server, destination, { retries: 1, retryDelay: 10 }),
      );
      assert.equal(report.ok, true);
      assert.deepEqual(report.routes, ['/']);
      assert.equal(report.routeDetails[0].attempts, 2);
    } finally {
      await server.close();
    }
  });

  it('fails without retries and writes a trace on the final attempt', async () => {
    const server = await startTestServer();
    server.failAlways();
    const destination = await makeStaticSite({});
    try {
      const report = await prerender(
        await serveCommandOptions(server, destination, { traceOnError: true }),
      );
      assert.equal(report.ok, false);
      assert.equal(report.errors[0].attempts, 1);
      assert.equal(report.traces.length, 1);
      const trace = report.traces[0];
      const bytes = await fs.readFile(trace.file);
      assert.equal(bytes.subarray(0, 2).toString('utf8'), 'PK');
      assert.equal(trace.file.startsWith(path.join(destination, 'snappy-traces')), true);
    } finally {
      await server.close();
    }
  });

  it('writes no trace in dry-run mode', async () => {
    const server = await startTestServer();
    server.failAlways();
    const destination = await makeStaticSite({});
    try {
      const report = await prerender(
        await serveCommandOptions(server, destination, { traceOnError: true, dryRun: true }),
      );
      assert.equal(report.ok, false);
      assert.deepEqual(report.traces, []);
      const exists = await fs
        .stat(path.join(destination, 'snappy-traces'))
        .then(() => true)
        .catch(() => false);
      assert.equal(exists, false);
    } finally {
      await server.close();
    }
  });
});
