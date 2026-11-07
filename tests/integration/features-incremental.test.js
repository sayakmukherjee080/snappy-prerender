import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  IncrementalCacheLockError,
  incrementalLockFile,
} from '../../src/core/incremental-cache.js';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite, page } from './support.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, '..', 'fixtures');
const cacheDirs = [];
const outputDirs = [];
after(async () => {
  for (const dir of cacheDirs) await fs.rm(dir, { recursive: true, force: true });
  for (const dir of outputDirs) await fs.rm(dir, { recursive: true, force: true });
  await cleanup();
});

async function cachePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-incremental-cache-'));
  cacheDirs.push(dir);
  return path.join(dir, 'cache.json');
}

async function outputDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-incremental-out-'));
  outputDirs.push(dir);
  return dir;
}

function options(sourceDir, cache, destination, overrides = {}) {
  return {
    sourceDir,
    destination,
    include: ['/'],
    crawl: false,
    verify: false,
    audit: false,
    logLevel: 'silent',
    captureFormState: false,
    captureRuntimeStyles: false,
    incremental: { cachePath: cache },
    ...overrides,
  };
}

describe('prerender integration: incremental builds', () => {
  it('reuses unchanged static routes and renders only the changed route', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', ['/about']),
      'about/index.html': page('About'),
    });
    const cache = await cachePath();
    const destination = await outputDir();

    const first = await prerender(
      options(sourceDir, cache, destination, { include: ['/', '/about'] }),
    );
    assert.deepEqual(
      first.routeDetails.map((detail) => detail.status),
      ['written', 'written'],
    );
    assert.equal(first.incremental.reusedStatic, 0);

    const second = await prerender(
      options(sourceDir, cache, destination, { include: ['/', '/about'] }),
    );
    assert.deepEqual(
      second.routeDetails.map((detail) => detail.status),
      ['cached', 'cached'],
    );
    assert.equal(second.incremental.reusedStatic, 2);

    await fs.writeFile(path.join(sourceDir, 'about', 'index.html'), page('About changed'));
    const third = await prerender(
      options(sourceDir, cache, destination, { include: ['/', '/about'] }),
    );
    assert.deepEqual(
      third.routeDetails.map((detail) => detail.status),
      ['cached', 'written'],
    );
    assert.equal(third.incremental.reusedStatic, 1);
    assert.equal(
      third.incremental.invalidated.some((entry) => entry.reason === 'source'),
      true,
    );
  });

  it('revalidates a changed API response and reuses it while unchanged', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': fetchPage(),
      'data.json': JSON.stringify({ title: 'First' }),
    });
    const cache = await cachePath();
    const destination = await outputDir();

    const first = await prerender(options(sourceDir, cache, destination));
    assert.equal(first.routeDetails[0].status, 'written');
    assert.equal(first.incremental.rendered, 1);

    const second = await prerender(options(sourceDir, cache, destination));
    assert.equal(second.routeDetails[0].status, 'cached');
    assert.equal(second.incremental.reusedData, 1);
    assert.equal(second.incremental.revalidated, 1);

    await fs.writeFile(path.join(sourceDir, 'data.json'), JSON.stringify({ title: 'Second' }));
    const third = await prerender(options(sourceDir, cache, destination));
    assert.equal(third.routeDetails[0].status, 'written');
    assert.equal(third.incremental.dataChanged, 1);
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.equal(html.includes('Second'), true);
  });

  it('restores cached HTML after a build replaces in-place output with the source shell', async () => {
    const source = fetchPage();
    const sourceDir = await makeStaticSite({
      'index.html': source,
      'data.json': JSON.stringify({ title: 'First' }),
    });
    const cache = await cachePath();

    await prerender(options(sourceDir, cache));
    const rendered = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(rendered.includes('First'), true);

    await fs.writeFile(path.join(sourceDir, 'index.html'), source);
    const second = await prerender(options(sourceDir, cache));
    assert.equal(second.routeDetails[0].status, 'cached');
    const restored = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(restored.includes('First'), true);
  });

  it('reuses data in trust mode without revalidating', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': fetchPage(),
      'data.json': JSON.stringify({ title: 'First' }),
    });
    const cache = await cachePath();
    const destination = await outputDir();

    await prerender(options(sourceDir, cache, destination));
    await fs.writeFile(path.join(sourceDir, 'data.json'), JSON.stringify({ title: 'Second' }));
    const trusted = await prerender(
      options(sourceDir, cache, destination, {
        incremental: { cachePath: cache, mode: 'trust' },
      }),
    );
    assert.equal(trusted.routeDetails[0].status, 'cached');
    assert.equal(trusted.incremental.reusedData, 1);
    assert.equal(trusted.incremental.dataChanged, 0);
  });

  it('renders a newly added route without invalidating existing routes', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();

    await prerender(options(sourceDir, cache, destination));
    await fs.mkdir(path.join(sourceDir, 'about'), { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'about', 'index.html'), page('About'));

    const second = await prerender(
      options(sourceDir, cache, destination, { include: ['/', '/about'] }),
    );
    const statuses = Object.fromEntries(
      second.routeDetails.map((detail) => [detail.route, detail.status]),
    );
    assert.equal(statuses['/'], 'cached');
    assert.equal(statuses['/about'], 'written');
    assert.equal(second.incremental.reusedStatic, 1);
  });

  it('reuses routes whose hydration verification is intentionally skipped', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    const optionsWithVerify = {
      verify: true,
      hydration: { skip: ['/*'] },
    };

    const first = await prerender(options(sourceDir, cache, destination, optionsWithVerify));
    assert.equal(first.verification.policySkipped, 1);

    const second = await prerender(options(sourceDir, cache, destination, optionsWithVerify));
    assert.equal(second.routeDetails[0].status, 'cached');
  });

  it('invalidates cached output when an output-affecting option changes', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    await prerender(options(sourceDir, cache, destination));

    const changed = await prerender(
      options(sourceDir, cache, destination, {
        transformHtml: (html) => html.replace('Home', 'Changed'),
      }),
    );
    assert.notEqual(changed.routeDetails[0].status, 'cached');
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.equal(html.includes('Changed'), true);
  });

  it('restores generated state scripts for cached routes in a new output directory', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': fetchPage(),
      'data.json': JSON.stringify({ title: 'First' }),
    });
    const cache = await cachePath();
    const firstDestination = await outputDir();
    const secondDestination = await outputDir();
    const stateOptions = { cacheAjaxRequests: true, externalScripts: true };

    const first = await prerender(options(sourceDir, cache, firstDestination, stateOptions));
    assert.equal(first.routeDetails[0].status, 'written');
    const stateFile = first.files.find((file) => file.file?.startsWith('snappy/state-'));
    assert.ok(stateFile);

    const second = await prerender(options(sourceDir, cache, secondDestination, stateOptions));
    assert.equal(second.routeDetails[0].status, 'cached');
    await fs.stat(path.join(secondDestination, stateFile.file));
    const html = await fs.readFile(path.join(secondDestination, 'index.html'), 'utf8');
    assert.equal(html.includes(stateFile.file), true);
  });

  it('does not write the incremental cache in dry-run mode', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    const dry = await prerender(options(sourceDir, cache, destination, { dryRun: true }));
    assert.equal(dry.incremental.state, 'dry-run');
    await assert.rejects(() => fs.stat(cache), /ENOENT/);

    const real = await prerender(options(sourceDir, cache, destination));
    assert.equal(real.incremental.state, 'written');
    await fs.stat(cache);
  });

  it('refuses a cache inside the build output', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    await assert.rejects(
      () =>
        prerender({
          ...options(sourceDir, path.join(sourceDir, '.snappy-cache.json')),
          audit: false,
        }),
      /cachePath must be outside/,
    );
  });

  it('honours a per-route incremental opt-out', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    await prerender(options(sourceDir, cache, destination));

    const forced = await prerender(
      options(sourceDir, cache, destination, {
        routeOverrides: [{ match: '/', incremental: false }],
      }),
    );
    assert.notEqual(forced.routeDetails[0].status, 'cached');
    assert.equal(forced.incremental.excluded, 1);
  });

  it('does not cache data responses larger than the configured limit', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': fetchPage(),
      'data.json': JSON.stringify({ title: 'First', padding: 'x'.repeat(200) }),
    });
    const cache = await cachePath();
    const destination = await outputDir();
    const limited = { data: { maxBytes: 32 } };

    const first = await prerender(
      options(sourceDir, cache, destination, { incremental: { cachePath: cache, ...limited } }),
    );
    assert.equal(first.routeDetails[0].status, 'written');
    const second = await prerender(
      options(sourceDir, cache, destination, { incremental: { cachePath: cache, ...limited } }),
    );
    assert.notEqual(second.routeDetails[0].status, 'cached');
  });

  it('fails fast when another live build owns the cache lock', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    await fs.mkdir(path.dirname(cache), { recursive: true });
    await fs.writeFile(
      incrementalLockFile(cache),
      `${JSON.stringify({ pid: process.pid, startedAt: Date.now(), token: 'running' })}\n`,
    );
    await assert.rejects(prerender(options(sourceDir, cache, destination)), (error) => {
      assert.equal(error instanceof IncrementalCacheLockError, true);
      assert.match(error.message, /locked by another build/);
      return true;
    });
    await fs.rm(incrementalLockFile(cache), { force: true });
  });

  it('serializes two builds that share one cache and leaves no temporary files', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', ['/about']),
      'about/index.html': page('About'),
    });
    const cache = await cachePath();
    const firstDestination = await outputDir();
    const secondDestination = await outputDir();
    const withLockWait = (destination) =>
      options(sourceDir, cache, destination, {
        include: ['/', '/about'],
        incremental: { cachePath: cache, lockTimeout: 15000 },
      });
    const [first, second] = await Promise.all([
      prerender(withLockWait(firstDestination)),
      prerender(withLockWait(secondDestination)),
    ]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(
      await fs.stat(incrementalLockFile(cache)).then(
        () => true,
        () => false,
      ),
      false,
    );
    const cacheContents = JSON.parse(await fs.readFile(cache, 'utf8'));
    assert.equal(cacheContents.routes.length, 2);
    const cacheDir = path.dirname(cache);
    const entries = await fs.readdir(cacheDir, { recursive: true });
    assert.equal(
      entries.some((entry) => entry.includes('.snappy-tmp')),
      false,
    );
  });

  it('waits for a lock when lockTimeout is set', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    await fs.mkdir(path.dirname(cache), { recursive: true });
    await fs.writeFile(
      incrementalLockFile(cache),
      `${JSON.stringify({ pid: process.pid, startedAt: Date.now(), token: 'running' })}\n`,
    );
    setTimeout(() => {
      fs.rm(incrementalLockFile(cache), { force: true });
    }, 150);
    const report = await prerender(
      options(sourceDir, cache, destination, {
        incremental: { cachePath: cache, lockTimeout: 2000 },
      }),
    );
    assert.equal(report.ok, true);
    assert.equal(
      await fs.stat(incrementalLockFile(cache)).then(
        () => true,
        () => false,
      ),
      false,
    );
  });

  it('reclaims a stale lock and releases the lock after the run', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    await fs.mkdir(path.dirname(cache), { recursive: true });
    await fs.writeFile(
      incrementalLockFile(cache),
      `${JSON.stringify({ pid: 2 ** 30, startedAt: Date.now(), token: 'stale' })}\n`,
    );
    const report = await prerender(options(sourceDir, cache, destination));
    assert.equal(report.ok, true);
    assert.equal(
      await fs.stat(incrementalLockFile(cache)).then(
        () => true,
        () => false,
      ),
      false,
    );
  });

  it('prunes cache pages and assets that the new cache no longer references', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', ['/about']),
      'about/index.html': page('About'),
    });
    const cache = await cachePath();
    const destination = await outputDir();
    await prerender(options(sourceDir, cache, destination, { include: ['/', '/about'] }));
    const cacheFiles = path.join(path.dirname(cache), 'cache-files');
    const generatedDir = path.join(cacheFiles, 'generated', 'snappy');
    const vendorDir = path.join(cacheFiles, 'vendor');
    await fs.mkdir(generatedDir, { recursive: true });
    await fs.mkdir(vendorDir, { recursive: true });
    await fs.writeFile(path.join(cacheFiles, 'stale.html'), 'stale');
    await fs.writeFile(path.join(generatedDir, 'stale.js'), 'stale');
    await fs.writeFile(path.join(vendorDir, 'stale.css'), 'stale');

    const second = await prerender(options(sourceDir, cache, destination, { include: ['/'] }));
    assert.equal(second.ok, true);
    const exists = (file) =>
      fs.stat(path.join(cacheFiles, file)).then(
        () => true,
        () => false,
      );
    assert.equal(await exists('stale.html'), false);
    assert.equal(await exists('generated/snappy/stale.js'), false);
    assert.equal(await exists('vendor/stale.css'), false);
    const cacheContents = JSON.parse(await fs.readFile(cache, 'utf8'));
    assert.equal(cacheContents.routes.length, 1);
    assert.equal(cacheContents.routes[0].route, '/');
    assert.equal(await exists(cacheContents.routes[0].htmlFile), true);
  });

  it('disables incremental caching for image output with a warning', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    const messages = [];
    const log = {
      level: 'info',
      debug: () => {},
      info: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
      success: (message) => messages.push(message),
    };
    const report = await prerender(options(sourceDir, cache, destination, { saveAs: 'png' }), {
      log,
    });
    assert.equal(report.incremental, null);
    assert.equal(
      await fs.stat(cache).then(
        () => true,
        () => false,
      ),
      false,
    );
    assert.equal(
      messages.some((message) => message.includes('Incremental prerendering is disabled')),
      true,
    );
  });

  it('disables incremental caching for serveCmd with a warning', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    const port = 48000 + Math.floor(Math.random() * 2000);
    const url = `http://127.0.0.1:${port}/`;
    const fixtureServer = path.join(fixtureRoot, 'static-server.mjs');
    const quote = (value) => `"${value}"`;
    const messages = [];
    const log = {
      level: 'info',
      debug: () => {},
      info: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
      success: (message) => messages.push(message),
    };
    const report = await prerender(
      options(sourceDir, cache, destination, {
        url,
        serveCmd: `${quote(process.execPath)} ${quote(fixtureServer)} ${quote(sourceDir)} ${port}`,
      }),
      { log },
    );
    assert.equal(report.incremental, null);
    assert.equal(
      await fs.stat(cache).then(
        () => true,
        () => false,
      ),
      false,
    );
    assert.equal(
      messages.some((message) => message.includes('Incremental prerendering is disabled')),
      true,
    );
  });

  it('expires cached routes with maxAge and honours exclude patterns', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home') });
    const cache = await cachePath();
    const destination = await outputDir();
    await prerender(options(sourceDir, cache, destination));

    const expired = await prerender(
      options(sourceDir, cache, destination, {
        incremental: { cachePath: cache, maxAge: 0 },
      }),
    );
    assert.notEqual(expired.routeDetails[0].status, 'cached');
    assert.equal(
      expired.incremental.invalidated.some((entry) => entry.reason === 'max-age'),
      true,
    );

    const excluded = await prerender(
      options(sourceDir, cache, destination, {
        incremental: { cachePath: cache, exclude: ['/*'] },
      }),
    );
    assert.notEqual(excluded.routeDetails[0].status, 'cached');
    assert.equal(excluded.incremental.excluded, 1);
  });
});

function fetchPage() {
  return `<!doctype html><html><head><title>API fixture</title></head><body><h1>Loading</h1><script>fetch('/data.json').then((response) => response.json()).then((data) => { document.querySelector('h1').textContent = data.title; });</script></body></html>`;
}
