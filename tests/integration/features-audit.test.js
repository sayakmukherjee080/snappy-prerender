import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite } from './support.js';

after(cleanup);

function auditSite() {
  return makeStaticSite({
    'index.html': `<!doctype html><html><head><title>Home</title><meta name="description" content="Home copy"></head><body><h1>Home</h1><a href="/about">About</a><a href="/missing">Missing</a></body></html>`,
    'about/index.html': `<!doctype html><html><head><title>Home</title><meta name="description" content="Home copy"></head><body><h1>About</h1></body></html>`,
    'private/index.html': `<!doctype html><html><head><title>Private</title><meta name="description" content="Private copy"><meta name="robots" content="noindex"></head><body><h1>Private</h1></body></html>`,
    '404.html': `<!doctype html><html><head><title>Not found</title><meta name="description" content="Missing page"></head><body><h1>Not found</h1></body></html>`,
  });
}

const options = (sourceDir, overrides = {}) => ({
  sourceDir,
  include: ['/', '/about', '/private', '/404'],
  notFoundRoute: '/404',
  metadata: { siteUrl: 'https://example.com', trailingSlash: 'never' },
  sitemap: true,
  audit: true,
  verify: false,
  logLevel: 'silent',
  captureFormState: false,
  captureRuntimeStyles: false,
  ...overrides,
});

describe('prerender integration: audit and report', () => {
  it('reports broken links and duplicate titles without failing the run', async () => {
    const sourceDir = await auditSite();
    const report = await prerender(options(sourceDir));
    assert.equal(report.ok, true);

    const rules = report.audit.errors.map((finding) => finding.rule);
    assert.ok(rules.includes('broken-internal-link'));
    assert.ok(rules.includes('duplicate-title'));
    assert.equal(report.audit.linksChecked > 0, true);
    const broken = report.audit.errors.find((finding) => finding.rule === 'broken-internal-link');
    assert.equal(broken.from, '/');
    assert.equal(broken.to, '/missing');
    assert.equal(broken.reason, 'missing');
    assert.equal(
      report.audit.warnings.some((finding) => finding.rule === 'missing-canonical'),
      true,
    );
  });

  it('excludes noindex and 404 pages from the sitemap without sitemap findings', async () => {
    const sourceDir = await auditSite();
    const report = await prerender(options(sourceDir));
    const sitemapRules = report.audit.errors
      .map((finding) => finding.rule)
      .filter((rule) => rule.startsWith('sitemap-'));
    assert.deepEqual(sitemapRules, []);
    assert.deepEqual(report.sitemap.locs, ['https://example.com/', 'https://example.com/about']);
  });

  it('fails the run with failOnAuditError', async () => {
    const sourceDir = await auditSite();
    const report = await prerender(options(sourceDir, { failOnAuditError: true }));
    assert.equal(report.ok, false);
  });

  it('writes a JSON report with the audit and route records', async () => {
    const sourceDir = await auditSite();
    const reportPath = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-report-')),
      'run.json',
    );
    const report = await prerender(options(sourceDir, { reportPath }));
    assert.equal(report.ok, true);
    const written = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    assert.equal(written.version, 1);
    assert.equal(written.ok, true);
    assert.equal(written.summary.routes, 4);
    assert.equal(written.routes.length, 4);
    assert.equal(written.audit.errors.length, report.audit.errors.length);
    assert.equal(written.audit.warnings.length, report.audit.warnings.length);
    assert.equal(written.routes[0].route, '/');
    const notFound = written.routes.find((entry) => entry.route === '/404');
    assert.equal(notFound.file, '404.html');
    assert.equal(notFound.noindex, true);
    assert.equal(JSON.stringify(written).includes('storageState'), false);
  });

  it('does not write a report in dry-run mode', async () => {
    const sourceDir = await auditSite();
    const reportPath = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-report-')),
      'run.json',
    );
    await prerender(options(sourceDir, { reportPath, dryRun: true }));
    const exists = await fs
      .stat(reportPath)
      .then(() => true)
      .catch(() => false);
    assert.equal(exists, false);
  });

  it('can skip the audit entirely', async () => {
    const sourceDir = await auditSite();
    const report = await prerender(options(sourceDir, { audit: false }));
    assert.equal(report.audit, null);
  });
});
