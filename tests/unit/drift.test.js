import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  assignLastmods,
  buildDriftResult,
  compareDrift,
  readBaseline,
  scopeHash,
  toDriftRecord,
  writeBaseline,
} from '../../src/core/drift.js';

const tempDirs = [];
after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

const record = (overrides = {}) => ({
  route: '/',
  file: 'index.html',
  htmlHash: 'html-1',
  contentHash: 'content-1',
  bytes: 100,
  textLength: 50,
  noindex: false,
  notFound: false,
  lastmod: '2026-01-01T00:00:00.000Z',
  meta: {
    title: 'Home',
    description: 'Demo',
    canonical: 'https://example.com/',
    robots: null,
    lang: 'en',
    h1Count: 1,
  },
  ...overrides,
});

const config = (overrides = {}) => ({
  baselinePath: '.snappy-baseline.json',
  failOnDrift: false,
  base: '/',
  flatOutput: false,
  include: ['/'],
  exclude: [],
  maxRoutes: null,
  notFoundRoute: '/404',
  routesFile: null,
  routesFromSitemap: null,
  metadata: { trailingSlash: 'preserve' },
  ...overrides,
});

describe('compareDrift', () => {
  it('reports unchanged routes', () => {
    const result = compareDrift([record()], [record()]);
    assert.equal(result.unchanged, 1);
    assert.equal(result.summary.changed, 0);
  });

  it('reports additions and removals', () => {
    const result = compareDrift(
      [record({ route: '/old', file: 'old/index.html' })],
      [record({ route: '/new', file: 'new/index.html' })],
    );
    assert.deepEqual(result.removed, [{ route: '/old', file: 'old/index.html' }]);
    assert.deepEqual(result.added, [{ route: '/new', file: 'new/index.html' }]);
  });

  it('reports content and metadata changes with before and after values', () => {
    const result = compareDrift(
      [record()],
      [
        record({
          contentHash: 'content-2',
          meta: { ...record().meta, title: 'New title' },
        }),
      ],
    );
    assert.equal(result.changed.length, 1);
    assert.deepEqual(result.changed[0].reasons, ['content', 'title']);
    assert.equal(result.changed[0].previous.title, 'Home');
    assert.equal(result.changed[0].current.title, 'New title');
  });

  it('reports a file move when content is unchanged', () => {
    const result = compareDrift(
      [record({ file: 'about/index.html', route: '/about' })],
      [record({ file: 'about.html', route: '/about' })],
    );
    assert.deepEqual(result.moved, [
      {
        route: '/about',
        fromFile: 'about/index.html',
        toFile: 'about.html',
        fromRoute: '/about',
        toRoute: '/about',
      },
    ]);
  });

  it('separates HTML-only and status-only changes', () => {
    const htmlOnly = compareDrift([record()], [record({ htmlHash: 'html-2' })]);
    assert.equal(htmlOnly.htmlOnly.length, 1);
    const status = compareDrift([record()], [record({ noindex: true })]);
    assert.equal(status.statusChanged.length, 1);
    assert.deepEqual(status.statusChanged[0].changes, [
      { field: 'noindex', from: false, to: true },
    ]);
  });
});

describe('assignLastmods', () => {
  it('updates changed and new routes while preserving unchanged dates', () => {
    const previous = [
      record(),
      record({ route: '/about', file: 'about/index.html', contentHash: 'old-about' }),
    ];
    const current = [
      record(),
      record({ route: '/about', file: 'about/index.html', contentHash: 'new-about' }),
      record({ route: '/new', file: 'new/index.html' }),
    ];
    const lastmods = assignLastmods(previous, current, '2026-02-02T00:00:00.000Z');
    assert.equal(lastmods.get('index.html'), '2026-01-01T00:00:00.000Z');
    assert.equal(lastmods.get('about/index.html'), '2026-02-02T00:00:00.000Z');
    assert.equal(lastmods.get('new/index.html'), '2026-02-02T00:00:00.000Z');
  });
});

describe('buildDriftResult', () => {
  it('creates a first-run baseline without listing every route as added', () => {
    const result = buildDriftResult({
      previous: { state: 'missing', baseline: null },
      current: [record()],
      config: config(),
      buildTime: '2026-02-02T00:00:00.000Z',
    });
    assert.equal(result.report.baseline.state, 'created');
    assert.equal(result.report.added.length, 0);
    assert.equal(result.report.unchanged, 1);
    assert.equal(result.baseline.routes[0].lastmod, '2026-02-02T00:00:00.000Z');
  });

  it('applies the failOnDrift statuses', () => {
    const result = buildDriftResult({
      previous: {
        state: 'ok',
        baseline: {
          scopeHash: scopeHash(config()),
          generatedAt: '2026-01-01T00:00:00.000Z',
          routes: [record()],
        },
      },
      current: [record({ contentHash: 'content-2' })],
      config: config({ failOnDrift: ['changed'] }),
      buildTime: '2026-02-02T00:00:00.000Z',
    });
    assert.equal(result.report.ok, false);
    assert.deepEqual(result.report.failures, [{ status: 'changed', count: 1 }]);
  });
});

describe('baseline storage', () => {
  it('reads a missing, invalid and version-mismatched baseline as data, not an error', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-drift-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'baseline.json');
    assert.equal((await readBaseline(file)).state, 'missing');

    await fs.writeFile(file, '{');
    assert.equal((await readBaseline(file)).state, 'invalid');

    await fs.writeFile(file, JSON.stringify({ version: 99, routes: [] }));
    assert.equal((await readBaseline(file)).state, 'version-mismatch');
  });

  it('writes and reads a baseline atomically', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-drift-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'nested', 'baseline.json');
    const baseline = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      scopeHash: 'scope',
      routes: [record()],
    };
    await writeBaseline(file, baseline);
    const read = await readBaseline(file);
    assert.equal(read.state, 'ok');
    assert.deepEqual(read.baseline.routes, baseline.routes);
  });
});

describe('scopeHash and records', () => {
  it('changes when the route scope changes', () => {
    assert.equal(scopeHash(config()), scopeHash(config()));
    assert.notEqual(scopeHash(config()), scopeHash(config({ include: ['/about'] })));
  });

  it('reduces route details to baseline fields', () => {
    const drift = toDriftRecord({
      ...record(),
      extra: 'ignored',
      meta: { title: 'Home', description: 'Demo' },
    });
    assert.equal(drift.extra, undefined);
    assert.equal(drift.meta.title, 'Home');
    assert.equal(drift.meta.canonical, null);
  });
});
