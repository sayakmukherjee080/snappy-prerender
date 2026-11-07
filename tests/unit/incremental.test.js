import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { parse } from 'parse5';
import {
  normaliseIncremental,
  normaliseVendorAssets,
  resolveConfig,
} from '../../src/core/config.js';
import { collectAssetDependencies, resolveSourceFile } from '../../src/core/incremental.js';
import {
  acquireIncrementalLock,
  INCREMENTAL_CACHE_VERSION,
  IncrementalCacheLockError,
  incrementalLockFile,
  incrementalScope,
  pruneIncrementalCache,
  readIncrementalCache,
  releaseIncrementalLock,
  writeIncrementalCache,
} from '../../src/core/incremental-cache.js';
import { DataRevalidator, dataRequestKey } from '../../src/core/revalidate.js';
import { inferType, verifyIntegrity } from '../../src/core/vendor-assets.js';

const dirs = [];
after(async () => {
  for (const dir of dirs) await fs.rm(dir, { recursive: true, force: true });
});

async function tempDir(prefix = 'snappy-incremental-') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

describe('incremental configuration', () => {
  it('normalises off, safe and trust modes', () => {
    assert.equal(normaliseIncremental(false).enabled, false);
    assert.equal(normaliseIncremental(true).mode, 'revalidate');
    assert.equal(normaliseIncremental('trust').mode, 'trust');
    const config = normaliseIncremental({ cachePath: 'cache.json', maxAge: '7d' });
    assert.equal(config.cachePath, 'cache.json');
    assert.equal(config.maxAge, 7 * 24 * 60 * 60 * 1000);
    assert.equal(config.lockTimeout, 0);
    assert.equal(normaliseIncremental({ lockTimeout: '30s' }).lockTimeout, 30_000);
    assert.throws(() => normaliseIncremental({ lockTimeout: 'soon' }), /lockTimeout/);
  });

  it('rejects unsafe or malformed incremental values', () => {
    assert.throws(() => normaliseIncremental({ mode: 'fast' }), /incremental.mode/);
    assert.throws(() => normaliseIncremental({ maxAge: 'soon' }), /incremental.maxAge/);
    assert.throws(() => normaliseIncremental({ data: { maxBytes: 0 } }), /data.maxBytes/);
    assert.throws(() => normaliseIncremental({ nope: true }), /incremental.nope/);
  });

  it('normalises vendor asset settings and rejects an empty allowlist', () => {
    const config = normaliseVendorAssets({ hosts: ['cdn.example.com'] });
    assert.equal(config.enabled, true);
    assert.deepEqual(config.types, ['css', 'font', 'image']);
    assert.equal(config.onError, 'warn');
    assert.throws(() => normaliseVendorAssets({}), /vendorAssets.hosts/);
    assert.throws(
      () => normaliseVendorAssets({ hosts: ['cdn.example.com'], types: ['js'] }),
      /types/,
    );
  });

  it('exposes the normalized incremental and vendoring objects through resolveConfig', () => {
    const config = resolveConfig({
      incremental: { cachePath: 'cache.json', mode: 'trust' },
      vendorAssets: ['cdn.example.com'],
      routeOverrides: [{ match: '/admin/*', incremental: false }],
    });
    assert.equal(config.incremental.enabled, true);
    assert.equal(config.incremental.mode, 'trust');
    assert.equal(config.vendorAssets.enabled, true);
    assert.equal(config.vendorAssets.hosts[0], 'cdn.example.com');
    assert.equal(config.routeOverrides[0].incremental, false);
  });

  it('rejects a non-boolean per-route incremental override', () => {
    assert.throws(
      () => resolveConfig({ routeOverrides: [{ match: '/', incremental: 'no' }] }),
      /routeOverrides.incremental/,
    );
  });

  it('warns when incremental or vendoring cannot take effect safely', () => {
    const config = resolveConfig({
      incremental: { mode: 'trust' },
      vendorAssets: {
        hosts: ['cdn.example.com'],
        types: ['css', 'script'],
        onError: 'warn',
        failOnExternalAssets: true,
      },
    });
    const warnings = config.warnings.join('\n');
    assert.match(warnings, /trust/);
    assert.match(warnings, /third-party scripts/);
    assert.match(warnings, /failOnExternalAssets/);
  });

  it('warns when incremental is disabled by serveCmd or image output', () => {
    const serve = resolveConfig({
      incremental: true,
      serveCmd: 'node server.js',
      url: 'http://127.0.0.1:3000',
    });
    assert.match(serve.warnings.join('\n'), /incremental is disabled with serveCmd/);
    const image = resolveConfig({ incremental: true, saveAs: 'png' });
    assert.match(image.warnings.join('\n'), /incremental is disabled/);
  });

  it('changes the scope for output config but not for route discovery', () => {
    const base = resolveConfig({ metadata: { siteUrl: 'https://example.com' } });
    const same = resolveConfig({
      metadata: { siteUrl: 'https://example.com' },
      include: ['/about'],
    });
    const changed = resolveConfig({
      metadata: { siteUrl: 'https://other.example' },
      include: ['/about'],
    });
    assert.equal(
      incrementalScope(base, '/tmp/site'),
      incrementalScope({ ...same, metadata: base.metadata }, '/tmp/site'),
    );
    assert.notEqual(incrementalScope(base, '/tmp/site'), incrementalScope(changed, '/tmp/site'));
  });
});

describe('incremental cache lock', () => {
  it('blocks a second owner and releases only for the owning token', async () => {
    const dir = await tempDir();
    const cache = path.join(dir, 'cache.json');
    const lock = await acquireIncrementalLock(cache);
    assert.equal(await fs.stat(incrementalLockFile(cache)).then(() => true), true);
    await assert.rejects(acquireIncrementalLock(cache), IncrementalCacheLockError);
    assert.equal(await releaseIncrementalLock(incrementalLockFile(cache), 'other-token'), false);
    assert.equal(await lock.release(), true);
    assert.equal(await lock.release(), false);
    const again = await acquireIncrementalLock(cache);
    assert.equal(await again.release(), true);
  });

  it('reclaims a lock whose owner process is gone', async () => {
    const dir = await tempDir();
    const cache = path.join(dir, 'cache.json');
    await fs.writeFile(
      incrementalLockFile(cache),
      `${JSON.stringify({ pid: 2 ** 30, startedAt: Date.now(), token: 'stale' })}\n`,
    );
    const lock = await acquireIncrementalLock(cache);
    assert.equal(await lock.release(), true);
  });

  it('reclaims an old lock and waits for a live one when a timeout is set', async () => {
    const dir = await tempDir();
    const cache = path.join(dir, 'cache.json');
    await fs.writeFile(
      incrementalLockFile(cache),
      `${JSON.stringify({ pid: process.pid, startedAt: Date.now() - 7 * 60 * 60 * 1000, token: 'old' })}\n`,
    );
    const old = await acquireIncrementalLock(cache);
    await old.release();

    const held = await acquireIncrementalLock(cache);
    setTimeout(() => {
      held.release();
    }, 150);
    const waited = await acquireIncrementalLock(cache, { timeout: 2000 });
    assert.equal(await waited.release(), true);
  });
});

describe('incremental cache pruning', () => {
  it('removes unreferenced pages, generated scripts and vendor assets', async () => {
    const dir = await tempDir();
    const cache = path.join(dir, 'cache.json');
    const htmlDir = path.join(dir, 'cache-files');
    await fs.mkdir(path.join(htmlDir, 'generated', 'snappy'), { recursive: true });
    await fs.mkdir(path.join(htmlDir, 'vendor', 'fonts'), { recursive: true });
    await fs.writeFile(path.join(htmlDir, 'keep.html'), 'keep');
    await fs.writeFile(path.join(htmlDir, 'stale.html'), 'stale');
    await fs.writeFile(path.join(htmlDir, 'generated', 'snappy', 'keep.js'), 'keep');
    await fs.writeFile(path.join(htmlDir, 'generated', 'snappy', 'stale.js'), 'stale');
    await fs.writeFile(path.join(htmlDir, 'generated', 'snappy-seo-locale-en.js'), 'keep');
    await fs.writeFile(path.join(htmlDir, 'vendor', 'keep.css'), 'keep');
    await fs.writeFile(path.join(htmlDir, 'vendor', 'stale.css'), 'stale');
    await fs.writeFile(path.join(htmlDir, 'vendor', 'fonts', 'keep.woff2'), 'keep');

    const removed = await pruneIncrementalCache({
      cachePath: cache,
      keepHtml: ['keep.html'],
      keepGenerated: ['snappy/keep.js', 'snappy-seo-locale-en.js'],
      keepVendor: ['keep.css', 'fonts/keep.woff2'],
    });

    assert.deepEqual(removed, ['snappy/stale.js', 'stale.css', 'stale.html']);
    const exists = (file) =>
      fs.stat(path.join(htmlDir, file)).then(
        () => true,
        () => false,
      );
    assert.equal(await exists('keep.html'), true);
    assert.equal(await exists('stale.html'), false);
    assert.equal(await exists('generated/snappy/keep.js'), true);
    assert.equal(await exists('generated/snappy/stale.js'), false);
    assert.equal(await exists('vendor/fonts/keep.woff2'), true);
    assert.equal(await exists('vendor/stale.css'), false);
  });
});

describe('incremental cache', () => {
  it('reads missing, corrupt and version-mismatched caches safely', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'cache.json');
    assert.equal((await readIncrementalCache(file)).state, 'missing');
    await fs.writeFile(file, '{bad');
    assert.equal((await readIncrementalCache(file)).state, 'invalid');
    await fs.writeFile(file, JSON.stringify({ version: 999, routes: [] }));
    assert.equal((await readIncrementalCache(file)).state, 'version-mismatch');
  });

  it('writes and reads a cache atomically', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'cache.json');
    const cache = {
      version: INCREMENTAL_CACHE_VERSION,
      routes: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
      scopeHash: 'scope',
    };
    const first = await writeIncrementalCache(file, cache);
    assert.equal(first.status, 'written');
    assert.deepEqual((await readIncrementalCache(file)).cache.routes, []);
    const second = await writeIncrementalCache(file, cache);
    assert.equal(second.status, 'unchanged');
  });
});

describe('incremental fingerprints', () => {
  it('resolves route-specific source files before the SPA shell', async () => {
    const dir = await tempDir();
    await fs.writeFile(path.join(dir, 'index.html'), 'shell');
    await fs.mkdir(path.join(dir, 'about'), { recursive: true });
    await fs.writeFile(path.join(dir, 'about', 'index.html'), 'about');
    assert.equal(await resolveSourceFile({ sourceDir: dir, route: '/about' }), 'about/index.html');
    assert.equal(await resolveSourceFile({ sourceDir: dir, route: '/missing' }), 'index.html');
  });

  it('hashes scripts and styles and only checks images for existence', () => {
    const document = parse(
      '<html><head><link rel="stylesheet" href="/app.css"><style>.x{background:url("/bg.png")}</style></head><body><script src="/app.js"></script><img src="/photo.png" srcset="/photo-2.png 2x"><img src="https://cdn.example/remote.png"></body></html>',
    );
    const dependencies = collectAssetDependencies(document, { base: '/', route: '/' });
    assert.equal(dependencies.get('/app.css'), 'hash');
    assert.equal(dependencies.get('/app.js'), 'hash');
    assert.equal(dependencies.get('/bg.png'), null);
    assert.equal(dependencies.get('/photo.png'), null);
    assert.equal(dependencies.get('/photo-2.png'), null);
    assert.equal(dependencies.has('/remote.png'), false);
  });

  it('builds stable request keys', () => {
    assert.equal(
      dataRequestKey({ method: 'GET', url: 'http://example.com/a', accept: 'json' }),
      'GET|http://example.com/a|json|',
    );
  });

  it('applies the API and vendor host allowlists during revalidation', () => {
    const config = resolveConfig({
      incremental: { data: { hosts: ['api.example.com', '*.cdn.example.com'] } },
      vendorAssets: { hosts: ['fonts.example.com'] },
    });
    const revalidator = new DataRevalidator({
      config,
      origin: 'http://127.0.0.1:1234',
      log: { debug() {}, warn() {} },
    });
    assert.equal(revalidator.hostAllowed(new URL('https://api.example.com/a'), false), true);
    assert.equal(revalidator.hostAllowed(new URL('https://a.cdn.example.com/a'), false), true);
    assert.equal(revalidator.hostAllowed(new URL('https://other.example.com/a'), false), false);
    assert.equal(revalidator.hostAllowed(new URL('https://fonts.example.com/a'), false), true);
    assert.equal(revalidator.hostAllowed(new URL('http://127.0.0.1:1234/a'), true), true);
  });
});

describe('vendor asset helpers', () => {
  it('infers common asset types', () => {
    assert.equal(inferType('font/woff2', 'https://x/font'), 'font');
    assert.equal(inferType('image/png', 'https://x/image'), 'image');
    assert.equal(inferType('text/css', 'https://x/style'), 'css');
    assert.equal(inferType('application/javascript', 'https://x/app'), 'script');
    assert.equal(inferType('application/octet-stream', 'https://x/app.css'), 'css');
    assert.equal(inferType('application/octet-stream', 'https://x/blob'), null);
  });

  it('verifies SRI without weakening it when bytes differ', () => {
    const bytes = Buffer.from('asset');
    const hash = 'sha256-8F7Q4V6YxJ0Jm5g5sC3D7j0y4m2m5Q0m6f0p9M3bQ7A=';
    assert.equal(verifyIntegrity(bytes, ''), true);
    assert.equal(
      verifyIntegrity(bytes, 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),
      false,
    );
    assert.equal(verifyIntegrity(Buffer.from('asset'), hash), false);
  });
});
