import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { launchBrowser } from '../../src/core/browser.js';
import { prerender, resolveConfig } from '../../src/core/index.js';
import { startStaticServer } from '../../src/core/server.js';
import snappy from '../../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, '..', 'fixtures');
const repoRoot = path.join(here, '..', '..');
const cliPath = path.join(repoRoot, 'src', 'cli.js');

const tempDirs = [];

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

/**
 * Builds a fixture app with Vite so the prerenderer runs against the same output a
 * real project produces.
 */
async function buildFixture(name) {
  const root = path.join(fixtureRoot, name);
  await build({ root, logLevel: 'silent' });
  return path.join(root, 'dist');
}

/**
 * Creates a throwaway static site. Used for the cases that do not need a real
 * bundled app, which keeps the suite fast.
 */
async function makeStaticSite(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-site-'));
  tempDirs.push(dir);
  for (const [name, html] of Object.entries(files)) {
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html);
  }
  return dir;
}

function page(title, links) {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('');
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${anchors}</body></html>`;
}

async function exists(target) {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
}

/**
 * Runs the CLI as a child process without blocking this process's event loop, so a server
 * started by a test can still answer the child's requests.
 */
function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], { cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('exit', (status) => resolve({ status, stdout, stderr }));
  });
}

/**
 * Starts a throwaway HTTP server on its own origin, counting every request so tests
 * can prove third-party traffic was blocked or allowed. The host is configurable so a
 * test can compare two origins that differ by host name rather than by port.
 */
async function startThirdParty(host = '127.0.0.1') {
  let hits = 0;
  const server = http.createServer((_request, response) => {
    hits += 1;
    response.setHeader('content-type', 'text/plain');
    response.end('third-party');
  });
  await new Promise((resolve) => server.listen(0, host, resolve));
  return {
    origin: `http://${host}:${server.address().port}`,
    hits: () => hits,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

// Builds a page that loads an image and a script from a separate origin.
function pageWithThirdParty(origin) {
  return `<!doctype html><html><head><title>Home page</title></head><body><h1>Home page</h1><img src="${origin}/pixel.png"><script src="${origin}/widget.js"></script></body></html>`;
}

describe('prerender integration: react 19 app', () => {
  let sourceDir;
  let report;

  const metadata = {
    siteUrl: 'https://pps.example',
    siteName: 'PPS',
    titleTemplate: '%s | PPS',
  };

  before(async () => {
    sourceDir = await buildFixture('react19-app');
    report = await prerender({ sourceDir, logLevel: 'silent', metadata });
  });

  it('crawls same-origin links from the root route', () => {
    assert.deepEqual([...report.routes].sort(), [
      '/',
      '/about',
      '/adjacent-text',
      '/head',
      '/inline-style',
      '/mismatch',
      '/native-title',
      '/page-error',
      '/suspense',
    ]);
  });

  it('writes static HTML per route containing the rendered markup', async () => {
    const home = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    const about = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(home, /Home page/);
    assert.match(about, /About page/);
    assert.equal(home.includes('snappy-freeze'), false);
  });

  it('passes hydration verification on matching routes', () => {
    const byRoute = new Map(report.verification.routes.map((entry) => [entry.route, entry]));
    assert.equal(byRoute.get('/').ok, true);
    assert.equal(byRoute.get('/about').ok, true);
    assert.deepEqual(byRoute.get('/').hydrationErrors, []);
  });

  it('reports the deliberate hydration mismatch without failing the run', () => {
    const mismatch = report.verification.routes.find((entry) => entry.route === '/mismatch');
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.hydrationErrors.length > 0, true);
    assert.equal(report.verification.ok, false);
    // Reported, not enforced: the static HTML is unchanged and crawlers read it either way.
    assert.equal(report.ok, true);
  });

  it('fails the run on hydration errors when enforcement is requested', async () => {
    const enforced = await prerender({
      sourceDir,
      logLevel: 'silent',
      metadata,
      failOnHydrationError: true,
    });
    assert.equal(enforced.verification.ok, false);
    assert.equal(enforced.ok, false);
  });

  it('reports the boot mode for the clean routes', () => {
    const byRoute = new Map(report.verification.routes.map((entry) => [entry.route, entry]));
    assert.equal(byRoute.get('/').mode, 'hydrated');
    assert.equal(byRoute.get('/about').mode, 'hydrated');
    assert.equal(byRoute.get('/').markupPreserved, true);
    assert.equal(report.verification.modes.hydrated >= 2, true);
  });

  it('keeps adjacent text nodes hydratable', () => {
    const adjacent = report.verification.routes.find((entry) => entry.route === '/adjacent-text');
    assert.equal(adjacent.ok, true);
    assert.equal(adjacent.mode, 'hydrated');
  });

  it('keeps inline style props hydratable', () => {
    const styled = report.verification.routes.find((entry) => entry.route === '/inline-style');
    assert.equal(styled.ok, true);
    assert.equal(styled.mode, 'hydrated');
  });

  it('leaves deterministic output untouched on a second run', async () => {
    const second = await prerender({ sourceDir, logLevel: 'silent', metadata });
    const stable = second.files.filter((file) => file.route !== '/mismatch');
    assert.equal(stable.length > 0, true);
    assert.equal(
      stable.every((file) => file.status === 'unchanged'),
      true,
    );
  });

  it('reconciles duplicate template metadata and writes head tags from the head layer', async () => {
    const head = await fs.readFile(path.join(sourceDir, 'head', 'index.html'), 'utf8');
    assert.match(head, /<title[^>]*>Nineteen head \| PPS<\/title>/);
    assert.equal((head.match(/<title/g) ?? []).length, 1);
    // The fixture template ships two descriptions; the head layer keeps the page's one.
    assert.equal((head.match(/name="description"/g) ?? []).length, 1);
    assert.match(head, /<meta[^>]*name="description"[^>]*content="Nine description"/);
    assert.match(
      head,
      /<meta[^>]*property="og:image"[^>]*content="https:\/\/pps\.example\/share-19\.png"/,
    );

    const verified = report.verification.routes.find((entry) => entry.route === '/head');
    assert.equal(verified.ok, true);
    assert.equal(verified.mode, 'hydrated');
  });

  it('records a crashing route as a page error without failing the run', () => {
    const entry = report.pageErrors.find((error) => error.route === '/page-error');
    assert.equal(entry !== undefined, true);
    assert.match(entry.message, /deliberate page error/);
    assert.equal(report.ok, true);
  });
});

describe('prerender integration: react 18 app', () => {
  let sourceDir;
  let report;

  const metadata = {
    siteUrl: 'https://pps.example',
    siteName: 'PPS',
    titleTemplate: '%s | PPS',
    defaultImage: '/share.png',
    trailingSlash: 'never',
  };

  before(async () => {
    sourceDir = await buildFixture('react18-app');
    report = await prerender({
      sourceDir,
      logLevel: 'silent',
      metadata,
      include: ['/', '/about', '/inline-style', '/head-a', '/head-b'],
    });
  });

  it('renders and verifies cleanly', async () => {
    assert.deepEqual([...report.routes].sort(), [
      '/',
      '/about',
      '/head-a',
      '/head-b',
      '/inline-style',
    ]);
    assert.equal(report.errors.length, 0);
    assert.equal(report.verification.ok, true);
    assert.equal(report.ok, true);
    const about = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(about, /About page/);
  });

  it('keeps inline style props hydratable', () => {
    const styled = report.verification.routes.find((entry) => entry.route === '/inline-style');
    assert.equal(styled.ok, true);
    assert.equal(styled.mode, 'hydrated');
  });

  it('writes per-route head metadata with the public site URL', async () => {
    const page = await fs.readFile(path.join(sourceDir, 'head-a', 'index.html'), 'utf8');
    // Tags carry the manager's owner attribute, so the patterns tolerate any attribute order.
    assert.match(page, /<title[^>]*>Head A \| PPS<\/title>/);
    assert.match(page, /<meta[^>]*property="og:title"[^>]*content="Head A \| PPS"/);
    assert.match(page, /<meta[^>]*property="og:url"[^>]*content="https:\/\/pps\.example\/head-a"/);
    assert.match(
      page,
      /<meta[^>]*property="og:image"[^>]*content="https:\/\/pps\.example\/share-a\.png"/,
    );
    assert.match(page, /<meta[^>]*name="twitter:card"[^>]*content="summary_large_image"/);
    assert.match(page, /<link[^>]*rel="canonical"[^>]*href="https:\/\/pps\.example\/head-a"/);
    assert.match(page, /<meta[^>]*name="robots"[^>]*content="index,follow"/);
    // The page's Head and the template both provide a description; the page's value wins
    // and never leaves two tags behind.
    assert.equal((page.match(/name="description"/g) ?? []).length, 1);
    assert.match(page, /<meta[^>]*name="description"[^>]*content="Page A description"/);
    // The defaults are persisted for the client as well as used while rendering.
    assert.match(page, /window\.__SNAPPY_META__/);

    const fallback = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(
      fallback,
      /<meta[^>]*property="og:image"[^>]*content="https:\/\/pps\.example\/share\.png"/,
    );
  });

  it('updates the head on client-side navigation without a reload', async () => {
    const config = resolveConfig({ logLevel: 'silent' });
    const server = await startStaticServer({ dir: sourceDir, base: '/' });
    const { browser } = await launchBrowser(config, {
      info() {},
      warn() {},
      error() {},
      debug() {},
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${server.origin}/head-a`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(
        () =>
          document.querySelector('meta[property="og:title"]')?.getAttribute('content') ===
          'Head A | PPS',
      );
      // Hydration adopted the prerendered tags rather than adding a second set.
      assert.equal(await page.locator('meta[property="og:title"]').count(), 1);
      assert.equal(await page.title(), 'Head A | PPS');

      await page.getByRole('button', { name: 'Go to Head B' }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('meta[property="og:title"]')?.getAttribute('content') ===
          'Head B | PPS',
      );

      assert.equal(await page.title(), 'Head B | PPS');
      assert.equal(await page.locator('meta[property="og:title"]').count(), 1);
      assert.equal(await page.locator('meta[name="description"]').count(), 1);
      assert.equal(
        await page.locator('meta[name="description"]').getAttribute('content'),
        'Page B description',
      );
      assert.equal(
        await page.locator('meta[property="og:type"]').getAttribute('content'),
        'article',
      );
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
        'https://pps.example/head-b',
      );

      await page.getByRole('button', { name: 'Go to About' }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('meta[name="description"]')?.getAttribute('content') ===
          'Template description',
      );

      // The template's own description comes back once no Head wants one, and the page's
      // share image falls back to the site default.
      assert.equal(await page.locator('meta[name="description"]').count(), 1);
      assert.equal(
        await page.locator('meta[name="description"]').getAttribute('content'),
        'Template description',
      );
      assert.equal(
        await page.locator('meta[property="og:image"]').getAttribute('content'),
        'https://pps.example/share.png',
      );
      assert.equal(await page.title(), 'Snappy Fixture | PPS');
    } finally {
      await context.close();
      await browser.close();
      await server.close();
    }
  });
});

describe('prerender integration: re-rendering apps', () => {
  it('detects an app that discards the prerendered markup instead of hydrating', async () => {
    const sourceDir = await buildFixture('react19-rerender-app');

    const tolerated = await prerender({ sourceDir, logLevel: 'silent' });

    assert.deepEqual([...tolerated.routes], ['/']);
    assert.equal(tolerated.verification.routes[0].markupPreserved, false);
    assert.equal(tolerated.verification.routes[0].mode, 're-rendered');
    assert.equal(tolerated.verification.modes['re-rendered'], 1);
    // createRoot cannot raise a hydration error, so this is reported rather than failed.
    assert.equal(tolerated.verification.ok, true);
    assert.equal(tolerated.ok, true);

    const enforced = await prerender({ sourceDir, logLevel: 'silent', failOnRerender: true });

    assert.equal(enforced.verification.modes['re-rendered'], 1);
    assert.equal(enforced.ok, false);
  });
});

describe('prerender integration: vite plugin', () => {
  it('prerenders during vite build using the resolved outDir', async () => {
    const root = path.join(fixtureRoot, 'react18-app');
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [react(), snappy()],
      resolve: { dedupe: ['react', 'react-dom'] },
      build: { outDir: 'dist', emptyOutDir: true },
    });
    const home = await fs.readFile(path.join(root, 'dist', 'index.html'), 'utf8');
    assert.match(home, /Home page/);
    const about = await fs.stat(path.join(root, 'dist', 'about', 'index.html'));
    assert.equal(about.isFile(), true);
  });

  it('skips library builds instead of failing them', async () => {
    const root = await makeStaticSite({ 'src/entry.js': 'export const answer = 42;' });
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [snappy()],
      build: {
        lib: { entry: path.join(root, 'src', 'entry.js'), formats: ['es'], fileName: 'entry' },
        outDir: 'dist',
        emptyOutDir: true,
      },
    });
    assert.equal(await exists(path.join(root, 'dist', 'index.html')), false);
  });

  it('skips non-client environments so multi-environment builds prerender once', async () => {
    const root = await makeStaticSite({ 'index.html': page('Home page', ['/about']) });
    const plugin = snappy({ logLevel: 'silent', verify: false });
    plugin.configResolved({
      root,
      base: '/',
      build: { outDir: '.', ssr: false, lib: false, write: true },
    });

    await plugin.closeBundle.call({ environment: { name: 'ssr' } });

    assert.equal(await exists(path.join(root, 'about', 'index.html')), false);
  });

  it('does not rerun when closeBundle fires again', async () => {
    const root = await makeStaticSite({ 'index.html': page('Home page', []) });
    const plugin = snappy({ logLevel: 'silent', verify: false });
    plugin.configResolved({
      root,
      base: '/',
      build: { outDir: '.', ssr: false, lib: false, write: true },
    });

    await plugin.closeBundle.call({ environment: { name: 'client' } });
    assert.equal(await exists(path.join(root, 'index.html')), true);

    await fs.rm(root, { recursive: true, force: true });
    await assert.doesNotReject(plugin.closeBundle.call({ environment: { name: 'client' } }));
  });
});

describe('prerender integration: static sites', () => {
  it('ignores external links so they cannot pollute the output', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home page', [
        '/about',
        'https://example.com/pricing',
        'https://github.com/sayakmukherjee080',
      ]),
      'about/index.html': page('About page', []),
    });
    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false });
    assert.deepEqual([...report.routes].sort(), ['/', '/about']);
    assert.equal(await exists(path.join(sourceDir, 'pricing')), false);
    assert.equal(await exists(path.join(sourceDir, 'sayakmukherjee080')), false);
  });

  it('writes flat files when flatOutput is set', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home page', ['/about']),
    });
    await prerender({ sourceDir, logLevel: 'silent', verify: false, flatOutput: true });
    assert.equal(await exists(path.join(sourceDir, 'about.html')), true);
    assert.equal(await exists(path.join(sourceDir, 'about', 'index.html')), false);
  });

  it('honours maxDepth when crawling', async () => {
    const files = {
      'index.html': page('Home page', ['/a']),
      'a/index.html': page('A page', ['/b']),
      'b/index.html': page('B page', ['/c']),
    };
    const sourceDir = await makeStaticSite(files);
    const seedsOnly = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      maxDepth: 0,
    });
    assert.deepEqual([...seedsOnly.routes].sort(), ['/']);

    const oneLevel = await prerender({ sourceDir, logLevel: 'silent', verify: false, maxDepth: 1 });
    assert.deepEqual([...oneLevel.routes].sort(), ['/', '/a']);
  });

  it('writes nothing on a dry run', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', ['/about']) });
    const report = await prerender({ sourceDir, logLevel: 'silent', dryRun: true });
    assert.equal(
      report.files.every((file) => file.status === 'dry-run'),
      true,
    );
    assert.equal(report.verification, null);
    assert.equal(await exists(path.join(sourceDir, 'about')), false);
  });

  it('prerenders routes under a base path', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home page', ['/app/about']),
    });
    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false, base: '/app/' });
    assert.deepEqual([...report.routes].sort(), ['/', '/about']);
    assert.equal(await exists(path.join(sourceDir, 'about', 'index.html')), true);
  });

  it('emits the not-found route as 404.html', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home page', ['/404']),
    });
    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false });
    assert.equal(await exists(path.join(sourceDir, '404.html')), true);
    assert.equal(
      report.files.some((file) => file.file === '404.html'),
      true,
    );
  });

  it('notes when the not-found route was never prerendered', async () => {
    const messages = [];
    const log = {
      level: 'info',
      debug: () => {},
      info: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
      success: (message) => messages.push(message),
    };

    const withoutNotFound = await makeStaticSite({ 'index.html': page('Home page', []) });
    await prerender({ sourceDir: withoutNotFound, logLevel: 'silent', verify: false }, { log });
    assert.equal(
      messages.some((message) => /no 404\.html was written/.test(message)),
      true,
    );

    messages.length = 0;
    const withNotFound = await makeStaticSite({
      'index.html': page('Home page', ['/404']),
      '404/index.html': page('404 page', []),
    });
    await prerender({ sourceDir: withNotFound, logLevel: 'silent', verify: false }, { log });
    assert.equal(
      messages.some((message) => /no 404\.html was written/.test(message)),
      false,
    );
    assert.equal(await exists(path.join(withNotFound, '404.html')), true);
  });

  it('fails with a clear message when sourceDir does not exist', async () => {
    await assert.rejects(
      prerender({ sourceDir: path.join(os.tmpdir(), 'snappy-missing-dir'), logLevel: 'silent' }),
      /sourceDir does not exist/,
    );
  });
});

describe('prerender integration: third-party requests', () => {
  it('allows third-party requests by default, during render and verification', async () => {
    const thirdParty = await startThirdParty();
    try {
      const sourceDir = await makeStaticSite({
        'index.html': pageWithThirdParty(thirdParty.origin),
      });
      const report = await prerender({ sourceDir, logLevel: 'silent' });
      assert.equal(report.verification.ok, true);
      assert.equal(thirdParty.hits() >= 2, true);
    } finally {
      await thirdParty.close();
    }
  });

  it('blocks third-party requests when blocking is switched on', async () => {
    const thirdParty = await startThirdParty();
    try {
      const sourceDir = await makeStaticSite({
        'index.html': pageWithThirdParty(thirdParty.origin),
      });
      await prerender({ sourceDir, logLevel: 'silent', blockThirdParty: true });
      assert.equal(thirdParty.hits(), 0);
    } finally {
      await thirdParty.close();
    }
  });

  it('allows only the listed hosts when blocking is on, and still hints them', async () => {
    const allowed = await startThirdParty('127.0.0.1');
    const blocked = await startThirdParty('localhost');
    try {
      // Proves the blocked origin is genuinely reachable, so a flat hit count means
      // blocking worked rather than the server being down.
      assert.equal((await fetch(`${blocked.origin}/ping`)).status, 200);
      const blockedBaseline = blocked.hits();

      const sourceDir = await makeStaticSite({
        'index.html': pageWithThirdParty(allowed.origin).replace(
          '</body>',
          `<img src="${blocked.origin}/pixel.png"></body>`,
        ),
      });

      await prerender({
        sourceDir,
        logLevel: 'silent',
        verify: false,
        blockThirdParty: true,
        allowedHosts: ['127.0.0.1'],
      });

      assert.equal(allowed.hits() > 0, true);
      assert.equal(blocked.hits(), blockedBaseline);

      const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
      assert.match(html, new RegExp(`<link rel="preconnect" href="${allowed.origin}">`));
      assert.match(html, new RegExp(`<link rel="preconnect" href="${blocked.origin}">`));
    } finally {
      await allowed.close();
      await blocked.close();
    }
  });
});

describe('prerender integration: failure handling', () => {
  it('records a write failure against its route and keeps writing the rest', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', ['/about']) });
    await fs.mkdir(path.join(sourceDir, 'about.html'));

    const report = await prerender({ sourceDir, logLevel: 'silent', flatOutput: true });

    assert.equal(report.errors.length, 1);
    assert.equal(report.errors[0].route, '/about');
    assert.match(report.errors[0].message, /write failed/);
    assert.equal(
      report.files.some((file) => file.route === '/' && file.status === 'written'),
      true,
    );
    assert.equal(
      report.verification.routes.some((entry) => entry.route === '/about'),
      false,
    );
    assert.equal(report.ok, false);
  });

  it('fails cleanly when serveCmd cannot start', async () => {
    await assert.rejects(
      prerender({
        logLevel: 'silent',
        verify: false,
        url: 'http://127.0.0.1:1/',
        serveCmd: 'snappy-prerender-definitely-not-a-real-command',
      }),
      /did not become reachable/,
    );
  });

  it('records uncaught page errors and reports them without enforcing by default', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Boom</title></head><body><script>throw new Error("fixture boom")</script></body></html>',
    });
    const messages = [];
    const log = {
      level: 'info',
      debug: () => {},
      info: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
      success: (message) => messages.push(message),
    };

    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false }, { log });
    assert.equal(report.pageErrors.length, 1);
    assert.equal(report.pageErrors[0].route, '/');
    assert.match(report.pageErrors[0].message, /fixture boom/);
    assert.equal(report.ok, true);
    assert.equal(
      messages.some((message) => message.includes('1 page error(s)')),
      true,
    );
    assert.equal(
      messages.some((message) => message.includes('Set failOnPageError to fail the build')),
      true,
    );

    const enforced = await prerender(
      { sourceDir, logLevel: 'silent', verify: false, failOnPageError: true },
      { log },
    );
    assert.equal(enforced.ok, false);
  });

  it('warns when the output carries more than one title element', async () => {
    const messages = [];
    const log = {
      level: 'info',
      debug: () => {},
      info: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
      success: (message) => messages.push(message),
    };

    const sourceDir = await buildFixture('react19-app');
    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false }, { log });

    assert.equal(report.duplicateTitles.includes('/native-title'), true);
    assert.equal(report.duplicateTitles.includes('/about'), false);
    assert.equal(
      messages.some((message) => message.includes('more than one <title> element')),
      true,
    );
  });

  it('renders a page whose load event is slowed by one asset', async () => {
    const slow = http.createServer((_request, response) => {
      setTimeout(() => {
        response.setHeader('content-type', 'image/png');
        response.end('png');
      }, 2000);
    });
    await new Promise((resolve) => slow.listen(0, '127.0.0.1', resolve));
    const port = slow.address().port;

    try {
      const sourceDir = await makeStaticSite({
        'index.html': [
          '<!doctype html><html><head><title>Home page</title></head><body><h1>Home page</h1>',
          `<img src="http://127.0.0.1:${port}/slow.png">`,
          '</body></html>',
        ].join(''),
      });
      // The timeout is shorter than the asset, so a strict load wait would fail the route.
      const report = await prerender({
        sourceDir,
        logLevel: 'silent',
        verify: false,
        timeout: 1500,
        quietPeriod: 300,
      });
      assert.equal(report.errors.length, 0);
      assert.equal(report.routes.includes('/'), true);
    } finally {
      slow.closeAllConnections();
      await new Promise((resolve) => slow.close(resolve));
    }
  });
});

describe('prerender integration: capture and optimisation options', () => {
  it('applies the prerender user agent, caches JSON and replays snapSaveState', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': [
        '<!doctype html><html><head><title>Home page</title>',
        '<script>window.snapSaveState = () => ({ __APP_STATE__: { count: 1 } });</script>',
        "<script>fetch('/api/data.json').then((r) => r.json()).then((d) => { document.title = d.title; });</script>",
        '</head><body><h1>Home page</h1>',
        '<script>document.body.dataset.ua = navigator.userAgent;</script>',
        '</body></html>',
      ].join(''),
      'api/data.json': JSON.stringify({ title: 'cached title' }),
    });

    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      cacheAjaxRequests: true,
      userAgent: 'SnappyTest/1.0',
    });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(report.errors.length, 0);
    assert.match(html, /data-ua="SnappyTest\/1\.0"/);
    assert.match(html, /cached title/);
    assert.match(html, /window\.snapStore=/);
    assert.match(html, /\\u002Fapi\\u002Fdata\.json/);
    assert.match(html, /window\["__APP_STATE__"\]=\{"count":1\}/);
  });

  it('escapes hostile state keys and values so they cannot break out of the script', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': [
        '<!doctype html><html><head><title>Home page</title>',
        '<script>',
        // Assembled at runtime, otherwise the literal close tag would terminate this
        // inline script and the hook would never be defined.
        "const close = '</' + 'script>';",
        'window.snapSaveState = () => ({',
        "  [close + '<img src=x onerror=alert(1)>']: close + '<script>alert(2)</' + 'script>',",
        '});',
        '</script></head><body><h1>Home page</h1></body></html>',
      ].join(''),
    });

    await prerender({ sourceDir, logLevel: 'silent', verify: false });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    const scripts = html.match(/<script[\s\S]*?<\/script>/g) ?? [];
    const breakouts = scripts.filter((block) => block.slice(0, -9).includes('</script'));
    assert.equal(breakouts.length, 0);
    assert.match(html, /window\["\\u003C\\u002Fscript/);
  });

  it('adds preconnect and image preload hints and writes a preload manifest', async () => {
    const thirdParty = await startThirdParty();
    try {
      const sourceDir = await makeStaticSite({
        'index.html': [
          '<!doctype html><html><head><title>Home page</title></head><body>',
          '<h1>Home page</h1>',
          '<img src="/hero.svg">',
          `<img src="${thirdParty.origin}/remote.png">`,
          '<script src="/app.js"></script>',
          '</body></html>',
        ].join(''),
        'hero.svg':
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
        'app.js': 'document.body.dataset.loaded = "yes";',
      });

      const report = await prerender({
        sourceDir,
        logLevel: 'silent',
        verify: false,
        preloadImages: true,
        preloadManifest: true,
      });

      const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
      assert.match(html, new RegExp(`<link rel="preconnect" href="${thirdParty.origin}">`));
      assert.match(html, /<link rel="preload" as="image" href="\/hero\.svg">/);
      assert.equal(report.preloadManifest?.routes, 1);

      const manifest = JSON.parse(
        await fs.readFile(path.join(sourceDir, 'preload-manifest.json'), 'utf8'),
      );
      assert.equal(manifest[0].source, '/');
      assert.match(manifest[0].headers[0].value, /<\/app\.js>;rel=preload;as=script/);
    } finally {
      await thirdParty.close();
    }
  });

  it('inlines stylesheets with the inline strategy', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home page</title><link rel="stylesheet" href="/style.css"></head><body><h1 class="hero">Home page</h1></body></html>',
      'style.css': '.hero { color: rgb(1, 2, 3); }',
    });

    await prerender({ sourceDir, logLevel: 'silent', verify: false, inlineCss: 'inline' });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('rel="stylesheet"'), false);
    assert.match(html, /<style>\.hero \{ color: rgb\(1, 2, 3\); \}<\/style>/);
  });

  it('inlines critical CSS with the critical strategy', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home page</title><link rel="stylesheet" href="/style.css"></head><body><h1 class="hero">Home page</h1></body></html>',
      'style.css': '.hero { color: rgb(4, 5, 6); }',
    });

    await prerender({ sourceDir, logLevel: 'silent', verify: false, inlineCss: 'critical' });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /<style>[\s\S]*\.hero[\s\S]*<\/style>/);
  });

  it('writes to a destination directory and leaves the source untouched', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', ['/about']) });
    const destination = await makeStaticSite({});
    const before = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');

    const report = await prerender({ sourceDir, destination, logLevel: 'silent', verify: false });

    assert.equal(await exists(path.join(destination, 'index.html')), true);
    assert.equal(await exists(path.join(destination, 'about', 'index.html')), true);
    assert.equal(await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8'), before);
    assert.equal(await exists(path.join(sourceDir, 'about')), false);
    assert.equal(
      report.files.every((file) => file.status === 'written'),
      true,
    );
  });

  it('captures screenshots when saveAs is png', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', ['/about']) });

    const report = await prerender({ sourceDir, logLevel: 'silent', saveAs: 'png' });

    const png = await fs.readFile(path.join(sourceDir, 'index.png'));
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.equal(await exists(path.join(sourceDir, 'about.png')), true);
    assert.equal(await exists(path.join(sourceDir, 'about', 'index.html')), false);
    assert.equal(report.verification, null);
  });

  it('marks scripts async and minifies the output', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home page</title></head><body>\n  <h1>Home page</h1>\n  <script src="/app.js"></script>\n</body></html>',
      'app.js': 'document.body.dataset.loaded = "yes";',
    });

    await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      asyncScriptTags: true,
      minifyHtml: true,
    });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /<script async src="\/app\.js">/);
    assert.equal(html.includes('\n  '), false);
    assert.match(html, /data-loaded="yes"/);
  });

  it('removes script and style tags when asked', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home page</title><style>.a{}</style></head><body><h1>Home page</h1><script src="/app.js"></script></body></html>',
      'app.js': '',
    });

    await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      removeScriptTags: true,
      removeStyleTags: true,
    });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('<script'), false);
    assert.equal(html.includes('<style'), false);
  });

  it('keeps the metadata script when script tags are stripped', async () => {
    const sourceDir = await buildFixture('react18-app');
    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      include: ['/head-a'],
      removeScriptTags: true,
      metadata: {
        siteUrl: 'https://pps.example',
        siteName: 'PPS',
        titleTemplate: '%s | PPS',
      },
    });

    assert.equal(report.errors.length, 0);
    const html = await fs.readFile(path.join(sourceDir, 'head-a', 'index.html'), 'utf8');
    assert.match(html, /<script data-snappy-meta[^>]*>/);
    assert.match(html, /window\.__SNAPPY_META__/);
    // The app bundle is gone as asked, and the stale script from a previous run with it.
    assert.equal(html.includes('/assets/index-'), false);
    assert.equal((html.match(/data-snappy-meta/g) ?? []).length, 1);
  });

  it('keeps head metadata intact through minification and async scripts', async () => {
    const sourceDir = await buildFixture('react18-app');
    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      include: ['/head-a'],
      minifyHtml: true,
      asyncScriptTags: true,
      metadata: { siteUrl: 'https://pps.example', siteName: 'PPS', titleTemplate: '%s | PPS' },
    });

    assert.equal(report.errors.length, 0);
    const html = await fs.readFile(path.join(sourceDir, 'head-a', 'index.html'), 'utf8');
    assert.match(html, /window\.__SNAPPY_META__/);
    // Attribute sorting means the property and content order is not fixed.
    assert.match(
      html,
      /<meta(?=[^>]*property="og:url")(?=[^>]*content="https:\/\/pps\.example\/head-a")[^>]*>/,
    );
    // The external bundle is marked async; the inline metadata script has no src and is left.
    assert.match(html, /<script[^>]*async[^>]*src=/);
  });

  it('writes preload manifest hints under the base path', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': [
        '<!doctype html><html><head><title>Home page</title>',
        '<link rel="stylesheet" href="/app/app.css">',
        '</head><body><h1>Home page</h1><script src="/app/app.js"></script></body></html>',
      ].join(''),
      'app.css': 'h1 { color: red; }',
      'app.js': 'document.body.dataset.js = "loaded";',
    });

    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      base: '/app/',
      preloadManifest: true,
    });

    assert.equal(report.errors.length, 0);
    const manifest = JSON.parse(
      await fs.readFile(path.join(sourceDir, 'preload-manifest.json'), 'utf8'),
    );
    assert.equal(manifest[0].source, '/app/');
    assert.match(manifest[0].headers[0].value, /<\/app\/app\.(css|js)>/);
  });

  it('leaves non-screen stylesheets as links when inlining', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': [
        '<!doctype html><html><head><title>Home page</title>',
        '<link rel="stylesheet" href="/screen.css">',
        '<link rel="stylesheet" href="/print.css" media="print">',
        '</head><body><h1>Home page</h1></body></html>',
      ].join(''),
      'screen.css': 'h1 { color: red; }',
      'print.css': 'h1 { color: black; }',
    });

    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      inlineCss: 'inline',
    });

    assert.equal(report.errors.length, 0);
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /h1 \{ color: red; \}/);
    assert.match(html, /media="print"/);
    assert.equal(html.includes('color: black'), false);
  });
});

describe('prerender integration: css-in-js', () => {
  const RUNTIME_PAGE = [
    '<!doctype html><html><head><title>Home page</title>',
    '<style>.plain-rule { color: rgb(1, 1, 1); }</style>',
    '<style id="runtime"></style>',
    '</head><body><h1 class="runtime-rule">Home page</h1>',
    '<script>',
    // Selectors are assembled at runtime so their literal text never appears in the
    // serialised script, which keeps the assertions below unambiguous.
    "const runtimeSelector = '.runtime' + '-rule';",
    "document.getElementById('runtime').sheet.insertRule(runtimeSelector + ' { color: rgb(10, 20, 30); }', 0);",
    "const adoptedSelector = '.adopted' + '-rule';",
    'const adopted = new CSSStyleSheet();',
    "adopted.replaceSync(adoptedSelector + ' { color: rgb(40, 50, 60); }');",
    'document.adoptedStyleSheets = [...document.adoptedStyleSheets, adopted];',
    '</script></body></html>',
  ].join('');

  it('captures CSSOM-only styles and constructable stylesheets', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': RUNTIME_PAGE });

    await prerender({ sourceDir, logLevel: 'silent', verify: false });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /\.runtime-rule \{ color: rgb\(10, 20, 30\); \}/);
    assert.match(html, /\.adopted-rule \{ color: rgb\(40, 50, 60\); \}/);
    assert.equal(html.split('.plain-rule').length - 1, 1);
  });

  it('leaves CSSOM-only styles alone when capture is disabled', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': RUNTIME_PAGE });

    await prerender({ sourceDir, logLevel: 'silent', verify: false, captureRuntimeStyles: false });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('.runtime-rule'), false);
    assert.equal(html.includes('.adopted-rule'), false);
  });
});

describe('prerender integration: form state', () => {
  const FORM_PAGE = [
    '<!doctype html><html><head><title>Home page</title></head><body>',
    '<input id="on" type="checkbox">',
    '<input id="off" type="checkbox" checked>',
    '<input type="radio" name="r" value="a">',
    '<input type="radio" name="r" value="b">',
    '<select id="s"><option value="a">A</option><option value="b">B</option></select>',
    '<script>',
    "document.getElementById('on').checked = true;",
    "document.getElementById('off').checked = false;",
    "document.querySelectorAll('input[type=radio]')[1].checked = true;",
    "document.getElementById('s').value = 'b';",
    '</script></body></html>',
  ].join('');

  it('syncs checked and selected state into the markup', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': FORM_PAGE });

    await prerender({ sourceDir, logLevel: 'silent', verify: false });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /<input id="on" type="checkbox" checked="">/);
    assert.match(html, /<input id="off" type="checkbox">/);
    assert.match(html, /<input type="radio" name="r" value="b" checked="">/);
    assert.match(html, /<option value="b" selected="">B<\/option>/);
  });

  it('leaves form state alone when capture is disabled', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': FORM_PAGE });

    await prerender({ sourceDir, logLevel: 'silent', verify: false, captureFormState: false });

    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.match(html, /<input id="on" type="checkbox">/);
    assert.match(html, /<input id="off" type="checkbox" checked="">/);
    assert.equal(html.includes('selected'), false);
  });
});

describe('prerender integration: limits and collisions', () => {
  it('stops at maxRoutes and fails the run so incomplete output is not shipped', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home page', ['/a']),
      'a/index.html': page('A page', ['/b']),
      'b/index.html': page('B page', []),
    });

    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false, maxRoutes: 2 });

    assert.deepEqual([...report.routes].sort(), ['/', '/a']);
    assert.deepEqual(report.truncated, { limit: 2, routes: 2 });
    assert.equal(report.ok, false);

    const tolerated = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      maxRoutes: 2,
      failOnError: false,
    });
    assert.equal(tolerated.truncated.limit, 2);
    assert.equal(tolerated.ok, true);
  });

  it('refuses routes that would write the same file', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', ['/index']) });

    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      flatOutput: true,
    });

    assert.deepEqual([...report.routes].sort(), ['/', '/index']);
    assert.equal(report.errors.length, 2);
    for (const error of report.errors) {
      assert.match(error.message, /output file collision: index\.html/);
    }
    assert.equal(report.files.length, 0);
    assert.equal(report.ok, false);
  });
});

describe('prerender integration: cli', () => {
  it('prerenders with explicit flags', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', ['/about']) });
    const cli = spawnSync(
      process.execPath,
      [cliPath, sourceDir, '--flat', '--no-verify', '--no-crawl', '--include', '/,/about'],
      { encoding: 'utf8', cwd: repoRoot },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(await exists(path.join(sourceDir, 'index.html')), true);
    assert.equal(await exists(path.join(sourceDir, 'about.html')), true);
  });

  it('writes nothing with --dry-run', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', []) });
    const cli = spawnSync(process.execPath, [cliPath, sourceDir, '--dry-run', '--no-verify'], {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    assert.equal(cli.status, 0, cli.stderr);
    const entries = await fs.readdir(sourceDir);
    assert.deepEqual(entries, ['index.html']);
    assert.match(cli.stdout, /Dry run/);
  });

  it('applies optimisation flags from the command line', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home page</title><link rel="stylesheet" href="/style.css"></head><body>\n  <h1>Home page</h1>\n</body></html>',
      'style.css': '.hero { color: rgb(7, 8, 9); }',
    });

    const cli = spawnSync(
      process.execPath,
      [cliPath, sourceDir, '--inline-css', 'inline', '--minify-html', '--no-verify'],
      { encoding: 'utf8', cwd: repoRoot },
    );

    assert.equal(cli.status, 0, cli.stderr);
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('rel="stylesheet"'), false);
    assert.match(html, /<style>\.hero\s*\{[^}]*rgb\(7, 8, 9\)[^}]*\}<\/style>/);
    assert.equal(html.includes('\n  '), false);
  });

  it('blocks third-party requests when the flag is passed', async () => {
    let hits = 0;
    const widget = http.createServer((_request, response) => {
      hits += 1;
      response.setHeader('content-type', 'application/javascript');
      response.end('window.widgetRan = true;');
    });
    await new Promise((resolve) => widget.listen(0, '127.0.0.1', resolve));
    const widgetUrl = `http://127.0.0.1:${widget.address().port}/widget.js`;

    try {
      const sourceDir = await makeStaticSite({
        'index.html': [
          '<!doctype html><html><head><title>Home page</title></head><body><h1>Home page</h1>',
          `<script src="${widgetUrl}"></script>`,
          '<script>document.body.dataset.widget = String(window.widgetRan === true);</script>',
          '</body></html>',
        ].join(''),
      });

      const blocked = await runCli([sourceDir, '--block-third-party', '--no-verify']);
      assert.equal(blocked.status, 0, blocked.stderr);
      assert.equal(hits, 0);

      const allowed = await runCli([sourceDir, '--no-verify']);
      assert.equal(allowed.status, 0, allowed.stderr);
      assert.equal(hits, 1);
      const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
      assert.match(html, /data-widget="true"/);
    } finally {
      widget.closeAllConnections();
      await new Promise((resolve) => widget.close(resolve));
    }
  });

  it('applies metadata flags from the command line', async () => {
    const sourceDir = await buildFixture('react18-app');
    const cli = spawnSync(
      process.execPath,
      [
        cliPath,
        sourceDir,
        '--include',
        '/head-a',
        '--no-verify',
        '--metadata-site-url',
        'https://cli.example',
        '--metadata-site-name',
        'CLI',
        '--metadata-title-template',
        '%s | CLI',
      ],
      { encoding: 'utf8', cwd: repoRoot },
    );

    assert.equal(cli.status, 0, cli.stderr);
    const html = await fs.readFile(path.join(sourceDir, 'head-a', 'index.html'), 'utf8');
    assert.match(html, /<title[^>]*>Head A \| CLI<\/title>/);
    assert.match(html, /<meta[^>]*property="og:url"[^>]*content="https:\/\/cli\.example\/head-a"/);
  });

  it('rejects a config file that does not export a plain object', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-config-'));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    await fs.writeFile(path.join(dir, 'snappy.config.js'), 'export default function () {};\n');

    const cli = spawnSync(process.execPath, [cliPath], { encoding: 'utf8', cwd: dir });

    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /plain options object/);
  });

  it('prints a stack trace for unexpected failures at debug level', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-config-'));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    await fs.writeFile(path.join(dir, 'snappy.config.js'), 'export default function () {};\n');

    const cli = spawnSync(process.execPath, [cliPath, '--log-level', 'debug'], {
      encoding: 'utf8',
      cwd: dir,
    });

    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /plain options object/);
    assert.match(cli.stderr, /at /);
  });

  it('reports normalisation work at debug level', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home</title><style>.a{}</style><style>.a{}</style></head><body><h1>Home page</h1></body></html>',
    });
    const cli = spawnSync(
      process.execPath,
      [cliPath, sourceDir, '--log-level', 'debug', '--no-verify'],
      { encoding: 'utf8', cwd: repoRoot },
    );

    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /duplicate style/);
  });
});

describe('prerender integration: serveCmd', () => {
  it('renders against a user-provided server and shuts it down afterwards', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home page', ['/about']),
      'about/index.html': page('About page', []),
    });
    const port = 42000 + Math.floor(Math.random() * 2000);
    const url = `http://127.0.0.1:${port}/`;
    const fixtureServer = path.join(fixtureRoot, 'static-server.mjs');
    const quote = (value) => `"${value}"`;

    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      url,
      serveCmd: `${quote(process.execPath)} ${quote(fixtureServer)} ${quote(sourceDir)} ${port}`,
    });

    assert.deepEqual([...report.routes].sort(), ['/', '/about']);
    assert.equal(report.errors.length, 0);
    assert.equal(await exists(path.join(sourceDir, 'about', 'index.html')), true);
    await assert.rejects(fetch(url));
  });

  it('force-kills a serveCmd that ignores SIGTERM', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', []) });
    const port = 44000 + Math.floor(Math.random() * 2000);
    const url = `http://127.0.0.1:${port}/`;
    const fixtureServer = path.join(fixtureRoot, 'static-server.mjs');
    const quote = (value) => `"${value}"`;

    const report = await prerender({
      sourceDir,
      logLevel: 'silent',
      verify: false,
      url,
      shutdownTimeout: 500,
      serveCmd: `${quote(process.execPath)} ${quote(fixtureServer)} ${quote(sourceDir)} ${port} ignore-sigterm`,
    });

    assert.equal(report.errors.length, 0);
    await assert.rejects(fetch(url));
  });

  it('skips verification and critical CSS with a clear warning', async () => {
    const messages = [];
    const log = {
      level: 'info',
      debug: () => {},
      info: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
      success: (message) => messages.push(message),
    };
    const sourceDir = await makeStaticSite({ 'index.html': page('Home page', []) });
    const port = 46000 + Math.floor(Math.random() * 2000);
    const url = `http://127.0.0.1:${port}/`;
    const fixtureServer = path.join(fixtureRoot, 'static-server.mjs');
    const quote = (value) => `"${value}"`;

    const report = await prerender(
      {
        sourceDir,
        logLevel: 'silent',
        inlineCss: 'critical',
        url,
        serveCmd: `${quote(process.execPath)} ${quote(fixtureServer)} ${quote(sourceDir)} ${port}`,
      },
      { log },
    );

    // The command server decides which document it serves, so hydration cannot be judged.
    assert.equal(report.verification, null);
    assert.equal(
      messages.some((message) => message.includes('verification is skipped with serveCmd')),
      true,
    );
    assert.equal(
      messages.some((message) => message.includes("inlineCss: 'critical' is skipped")),
      true,
    );
  });
});
