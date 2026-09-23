import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { prerender } from '../../src/core/index.js';
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
 * Starts a throwaway HTTP server on its own origin, counting every request so tests
 * can prove third-party traffic was blocked or allowed.
 */
async function startThirdParty() {
  let hits = 0;
  const server = http.createServer((_request, response) => {
    hits += 1;
    response.setHeader('content-type', 'text/plain');
    response.end('third-party');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
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

  before(async () => {
    sourceDir = await buildFixture('react19-app');
    report = await prerender({ sourceDir, logLevel: 'silent' });
  });

  it('crawls same-origin links from the root route', () => {
    assert.deepEqual([...report.routes].sort(), ['/', '/about', '/mismatch']);
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

  it('detects the deliberate hydration mismatch and fails the run', () => {
    const mismatch = report.verification.routes.find((entry) => entry.route === '/mismatch');
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.hydrationErrors.length > 0, true);
    assert.equal(report.verification.ok, false);
    assert.equal(report.ok, false);
  });

  it('leaves deterministic output untouched on a second run', async () => {
    const second = await prerender({ sourceDir, logLevel: 'silent' });
    const stable = second.files.filter((file) => file.route !== '/mismatch');
    assert.equal(stable.length > 0, true);
    assert.equal(
      stable.every((file) => file.status === 'unchanged'),
      true,
    );
  });
});

describe('prerender integration: react 18 app', () => {
  it('renders and verifies cleanly', async () => {
    const sourceDir = await buildFixture('react18-app');
    const report = await prerender({ sourceDir, logLevel: 'silent' });
    assert.deepEqual([...report.routes].sort(), ['/', '/about']);
    assert.equal(report.errors.length, 0);
    assert.equal(report.verification.ok, true);
    assert.equal(report.ok, true);
    const about = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(about, /About page/);
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

  it('fails with a clear message when sourceDir does not exist', async () => {
    await assert.rejects(
      prerender({ sourceDir: path.join(os.tmpdir(), 'snappy-missing-dir'), logLevel: 'silent' }),
      /sourceDir does not exist/,
    );
  });
});

describe('prerender integration: third-party requests', () => {
  it('blocks third-party requests during both render and verification by default', async () => {
    const thirdParty = await startThirdParty();
    try {
      const sourceDir = await makeStaticSite({
        'index.html': pageWithThirdParty(thirdParty.origin),
      });
      const report = await prerender({ sourceDir, logLevel: 'silent' });
      assert.equal(report.verification.ok, true);
      assert.equal(thirdParty.hits(), 0);
    } finally {
      await thirdParty.close();
    }
  });

  it('allows third-party requests when blocking is disabled', async () => {
    const thirdParty = await startThirdParty();
    try {
      const sourceDir = await makeStaticSite({
        'index.html': pageWithThirdParty(thirdParty.origin),
      });
      await prerender({ sourceDir, logLevel: 'silent', verify: false, blockThirdParty: false });
      assert.equal(thirdParty.hits() > 0, true);
    } finally {
      await thirdParty.close();
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

  it('records uncaught page errors in the report', async () => {
    const sourceDir = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Boom</title></head><body><script>throw new Error("fixture boom")</script></body></html>',
    });
    const report = await prerender({ sourceDir, logLevel: 'silent', verify: false });
    assert.equal(report.pageErrors.length, 1);
    assert.equal(report.pageErrors[0].route, '/');
    assert.match(report.pageErrors[0].message, /fixture boom/);
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
});
