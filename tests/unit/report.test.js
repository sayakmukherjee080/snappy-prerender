import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { buildReport, writeReport } from '../../src/core/report.js';

const tempDirs = [];

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

function reportOf(overrides = {}) {
  return {
    routeDetails: [
      {
        route: '/',
        file: 'index.html',
        status: 'written',
        meta: { title: 'Home' },
        framework: 'react',
        mode: 'hydrated',
      },
    ],
    files: [{ route: '/', file: 'index.html', status: 'written' }],
    errors: [],
    routeSources: [],
    notFoundRoutes: [],
    duplicatePages: [],
    truncated: null,
    sitemap: null,
    preloadManifest: null,
    audit: { errors: [], warnings: [], linksChecked: 3 },
    durationMs: 42,
    ok: true,
    ...overrides,
  };
}

describe('buildReport', () => {
  it('builds the versioned public shape', () => {
    const built = buildReport(reportOf());
    assert.equal(built.version, 1);
    assert.match(built.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(built.durationMs, 42);
    assert.equal(built.ok, true);
    assert.deepEqual(built.summary, { routes: 1, files: 1, errors: 0, warnings: 0 });
    assert.equal(built.routes[0].route, '/');
    assert.equal(built.routes[0].meta.title, 'Home');
    assert.equal(built.audit.linksChecked, 3);
  });

  it('counts audit findings in the summary', () => {
    const built = buildReport(
      reportOf({
        errors: [{ route: '/', message: 'write failed' }],
        audit: { errors: [{ rule: 'x' }], warnings: [{ rule: 'y' }], linksChecked: 0 },
      }),
    );
    assert.deepEqual(built.summary, { routes: 1, files: 1, errors: 2, warnings: 1 });
  });

  it('counts a route error once when the audit mirrors it', () => {
    const built = buildReport(
      reportOf({
        errors: [{ route: '/', message: 'write failed' }],
        audit: {
          errors: [{ rule: 'route-error', route: '/', message: 'write failed' }],
          warnings: [],
          linksChecked: 0,
        },
      }),
    );
    assert.equal(built.summary.errors, 1);
  });

  it('includes the verification summary without duplicating route records', () => {
    const built = buildReport(
      reportOf({
        verification: {
          ok: false,
          modes: { hydrated: 0, 're-rendered': 1, undetected: 0, unknown: 0 },
          frameworks: { react: 1 },
          skipped: 2,
          errors: [],
        },
      }),
    );
    assert.equal(built.verification.ok, false);
    assert.deepEqual(built.verification.modes, {
      hydrated: 0,
      're-rendered': 1,
      undetected: 0,
      unknown: 0,
    });
    assert.equal(built.verification.skipped, 2);
  });

  it('redacts credentials, query strings and the storage-state path', () => {
    const built = buildReport(
      reportOf({
        routeDetails: [
          {
            route: '/',
            file: 'index.html',
            finalUrl: 'https://user:pass@example.com/page?token=secret',
            failedRequests: [{ url: 'https://example.com/data?token=secret' }],
          },
        ],
        errors: [
          {
            route: '/',
            message: 'ENOENT /secret/state.json at https://example.com/x?token=secret',
          },
        ],
      }),
      { storageState: '/secret/state.json' },
    );
    const json = JSON.stringify(built);
    assert.equal(json.includes('pass'), false);
    assert.equal(json.includes('token=secret'), false);
    assert.equal(json.includes('/secret/state.json'), false);
    assert.equal(json.includes('https://example.com/page'), true);
    assert.equal(json.includes('https://example.com/data'), true);
  });

  it('never serialises configuration or captured state', () => {
    const built = buildReport(
      reportOf({
        storageState: '/secret/state.json',
        cacheAjaxRequests: true,
        config: { storageState: '/secret/state.json' },
      }),
    );
    const json = JSON.stringify(built);
    assert.equal(json.includes('state.json'), false);
    assert.equal(json.includes('capture'), false);
  });
});

describe('writeReport', () => {
  it('writes a report atomically and creates its parent directory', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-report-'));
    tempDirs.push(dir);
    const log = { info: () => {} };
    const target = path.join(dir, 'nested', 'report.json');
    const result = await writeReport({
      report: reportOf(),
      config: { reportPath: target, dryRun: false },
      log,
    });
    assert.equal(result.file, target);
    const written = JSON.parse(await fs.readFile(target, 'utf8'));
    assert.equal(written.version, 1);
  });

  it('does not write in dry-run mode', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-report-'));
    tempDirs.push(dir);
    const messages = [];
    const log = { info: (message) => messages.push(message) };
    const target = path.join(dir, 'report.json');
    const result = await writeReport({
      report: reportOf(),
      config: { reportPath: target, dryRun: true },
      log,
    });
    assert.equal(result.status, 'dry-run');
    assert.equal(
      await fs
        .stat(target)
        .then(() => true)
        .catch(() => false),
      false,
    );
    assert.match(messages[0], /would write report/);
  });

  it('writes nothing when no report path is configured', async () => {
    const result = await writeReport({
      report: reportOf(),
      config: { reportPath: null, dryRun: false },
      log: { info: () => {} },
    });
    assert.equal(result, null);
  });
});
