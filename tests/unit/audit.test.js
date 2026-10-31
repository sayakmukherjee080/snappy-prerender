import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { auditRun } from '../../src/core/audit/index.js';
import { auditMetadata } from '../../src/core/audit/metadata.js';

const tempDirs = [];

async function makeOutput(files = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-audit-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

function configOf(overrides = {}) {
  return { base: '/', flatOutput: false, auditIgnoreLinks: [], sitemap: false, ...overrides };
}

function pageMeta(overrides = {}) {
  return {
    title: 'Title',
    titleCount: 1,
    description: 'Description',
    canonical: null,
    robots: null,
    noindex: false,
    h1Count: 1,
    alternates: [],
    images: [],
    inlineStyleAttributes: 0,
    ...overrides,
  };
}

function detail(route, meta, overrides = {}) {
  return {
    route,
    file: route === '/' ? 'index.html' : `${route.slice(1)}/index.html`,
    meta,
    notFound: false,
    noindex: meta.noindex,
    buildOriginUrls: [],
    ...overrides,
  };
}

function reportOf(details, overrides = {}) {
  return {
    routeDetails: details,
    files: details.map((entry) => ({ route: entry.route, file: entry.file })),
    links: [],
    notFoundRoutes: [],
    cspSkipped: [],
    sitemap: null,
    ...overrides,
  };
}

describe('auditRun metadata', () => {
  it('reports duplicate titles as errors and duplicate descriptions as warnings', async () => {
    const outputDir = await makeOutput({ 'index.html': '', 'about/index.html': '' });
    const report = reportOf([
      detail('/', pageMeta({ title: 'Same', description: 'Same copy' })),
      detail('/about', pageMeta({ title: 'Same', description: 'Same copy' })),
    ]);
    const audit = await auditRun({ report, config: configOf(), outputDir });
    assert.equal(
      audit.errors.some((finding) => finding.rule === 'duplicate-title'),
      true,
    );
    assert.equal(
      audit.warnings.some((finding) => finding.rule === 'duplicate-description'),
      true,
    );
  });

  it('warns about missing metadata and reports a heading count that is not one', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([
      detail(
        '/',
        pageMeta({
          title: null,
          description: null,
          h1Count: 0,
        }),
      ),
    ]);
    const audit = await auditRun({ report, config: configOf(), outputDir });
    const rules = audit.warnings.map((finding) => finding.rule);
    assert.ok(rules.includes('missing-title'));
    assert.ok(rules.includes('missing-description'));
    assert.ok(rules.includes('missing-canonical'));
    assert.ok(rules.includes('heading-count'));
  });

  it('does not require a canonical on the not-found page', async () => {
    const outputDir = await makeOutput({ '404.html': '' });
    const report = reportOf([
      detail('/404', pageMeta({ noindex: true }), {
        file: '404.html',
        notFound: true,
      }),
    ]);
    const audit = await auditRun({ report, config: configOf(), outputDir });
    assert.equal(
      audit.warnings.some((finding) => finding.rule === 'missing-canonical'),
      false,
    );
  });

  it('warns about build-origin metadata and canonical mismatches', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([
      detail('/', pageMeta({ canonical: 'https://example.com/elsewhere/' }), {
        buildOriginUrls: ['http://127.0.0.1:1234'],
      }),
    ]);
    const audit = await auditRun({
      report,
      config: configOf({
        metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
      }),
      outputDir,
    });
    const rules = audit.warnings.map((finding) => finding.rule);
    assert.ok(rules.includes('build-origin-metadata'));
    assert.ok(rules.includes('canonical-mismatch'));
  });
});

describe('auditRun sitemap', () => {
  const config = configOf({
    sitemap: true,
    metadata: { siteUrl: 'https://example.com', trailingSlash: 'never' },
  });

  it('reports a missing page and a loc with no page', async () => {
    const outputDir = await makeOutput({ 'index.html': '', 'about/index.html': '' });
    const report = reportOf([detail('/', pageMeta()), detail('/about', pageMeta())], {
      sitemap: { locs: ['https://example.com/', 'https://example.com/ghost'] },
    });
    const audit = await auditRun({ report, config, outputDir });
    const rules = audit.errors.map((finding) => finding.rule);
    assert.ok(rules.includes('sitemap-missing-page'));
    assert.ok(rules.includes('sitemap-unknown-page'));
  });

  it('reports a noindex page listed in the sitemap', async () => {
    const outputDir = await makeOutput({ 'private/index.html': '' });
    const report = reportOf([detail('/private', pageMeta({ noindex: true }))], {
      sitemap: { locs: ['https://example.com/private'] },
    });
    const audit = await auditRun({
      report,
      config: { ...config, metadata: { ...config.metadata, trailingSlash: 'never' } },
      outputDir,
    });
    assert.equal(
      audit.errors.some((finding) => finding.rule === 'sitemap-noindex-page'),
      true,
    );
  });
});

describe('auditRun links', () => {
  it('passes written routes and files and reports a missing target', async () => {
    const outputDir = await makeOutput({ 'index.html': '', 'assets/app.js': '' });
    const report = reportOf([detail('/', pageMeta())], {
      links: [
        { from: '/', to: '/about' },
        { from: '/', to: '/assets/app.js' },
        { from: '/', to: '/missing' },
      ],
    });
    report.routeDetails.push(detail('/about', pageMeta({ title: 'About' })));
    const audit = await auditRun({ report, config: configOf(), outputDir });
    const broken = audit.errors.filter((finding) => finding.rule === 'broken-internal-link');
    assert.equal(broken.length, 1);
    assert.equal(broken[0].to, '/missing');
    assert.equal(broken[0].from, '/');
    assert.equal(audit.linksChecked, 3);
  });

  it('honours auditIgnoreLinks', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([detail('/', pageMeta())], {
      links: [{ from: '/', to: '/api/search' }],
    });
    const audit = await auditRun({
      report,
      config: configOf({ auditIgnoreLinks: ['/api/*'] }),
      outputDir,
    });
    assert.equal(audit.errors.length, 0);
  });

  it('warns about an orphan page but not the root or the 404 page', async () => {
    const outputDir = await makeOutput({
      'index.html': '',
      'about/index.html': '',
      '404.html': '',
    });
    const report = reportOf([
      detail('/', pageMeta()),
      detail('/about', pageMeta({ title: 'About' })),
      detail('/404', pageMeta({ title: 'Not found' }), { notFound: true }),
    ]);
    const audit = await auditRun({ report, config: configOf(), outputDir });
    const orphans = audit.warnings.filter((finding) => finding.rule === 'orphan-page');
    assert.deepEqual(
      orphans.map((finding) => finding.route),
      ['/about'],
    );
  });
});

describe('auditRun route health', () => {
  it('mirrors route errors, truncation, empty pages and duplicate output', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([detail('/', pageMeta())], {
      errors: [{ route: '/', message: 'write failed: disk full' }],
      truncated: { limit: 1, routes: 1, droppedRoutes: ['/about'] },
      emptyPages: ['/'],
      duplicatePages: [{ routes: ['/', '/about'] }],
    });
    const audit = await auditRun({
      report,
      config: configOf(),
      outputDir,
    });
    const rules = audit.errors.map((finding) => finding.rule);
    assert.ok(rules.includes('route-error'));
    assert.ok(rules.includes('route-cap'));
    assert.ok(rules.includes('empty-page'));
    assert.ok(rules.includes('duplicate-output'));
  });
});

describe('auditRun CSP hygiene', () => {
  it('warns about inline style attributes under hash mode', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([
      detail('/', pageMeta({ inlineStyleAttributes: 2, canonical: 'https://example.com/' })),
    ]);
    const audit = await auditRun({
      report,
      config: configOf({
        csp: 'hash',
        metadata: { siteUrl: 'https://example.com', trailingSlash: 'never' },
      }),
      outputDir,
    });
    assert.equal(
      audit.warnings.some((finding) => finding.rule === 'inline-style-attributes'),
      true,
    );
  });

  it('warns when a page already had a CSP meta and hashes were not injected', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([detail('/', pageMeta())], { cspSkipped: ['/'] });
    const audit = await auditRun({
      report,
      config: configOf({ csp: 'hash' }),
      outputDir,
    });
    assert.equal(
      audit.warnings.some((finding) => finding.rule === 'existing-csp-meta'),
      true,
    );
  });

  it('warns when the generated policy blocked a browser request', async () => {
    const outputDir = await makeOutput({ 'index.html': '' });
    const report = reportOf([detail('/', pageMeta())], {
      consoleErrors: [
        {
          route: '/',
          message:
            "Loading the stylesheet 'https://fonts.example/x' violates the following Content Security Policy directive: \"style-src 'self'\"",
        },
      ],
    });
    const audit = await auditRun({
      report,
      config: configOf({ csp: 'hash' }),
      outputDir,
    });
    assert.equal(
      audit.warnings.some((finding) => finding.rule === 'csp-console-violation'),
      true,
    );
  });
});

describe('auditMetadata hreflang', () => {
  const localeConfig = {
    base: '/',
    flatOutput: false,
    auditIgnoreLinks: [],
    sitemap: false,
    metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
    locales: {
      mode: 'path',
      default: 'en',
      xDefault: 'en',
      hreflang: true,
      list: [
        { code: 'en', url: 'https://example.com', htmlLang: 'en', ogLocale: 'en_US' },
        { code: 'fr', url: 'https://example.com', htmlLang: 'fr', ogLocale: 'fr_FR' },
      ],
    },
  };

  function hreflangFindings(pages) {
    const errors = [];
    const warnings = [];
    const add = (severity, rule, message, details = {}) => {
      (severity === 'error' ? errors : warnings).push({ rule, message, ...details });
    };
    auditMetadata({ pages, config: localeConfig, add });
    return { errors, warnings };
  }

  it('accepts a complete reciprocal hreflang set', () => {
    const enAlternates = [
      { hreflang: 'en', href: 'https://example.com/' },
      { hreflang: 'fr', href: 'https://example.com/fr/' },
      { hreflang: 'x-default', href: 'https://example.com/' },
    ];
    const frAlternates = [
      { hreflang: 'en', href: 'https://example.com/' },
      { hreflang: 'fr', href: 'https://example.com/fr/' },
      { hreflang: 'x-default', href: 'https://example.com/' },
    ];
    const findings = hreflangFindings([
      {
        route: '/',
        locale: 'en',
        file: 'index.html',
        meta: pageMeta({
          title: 'Home',
          canonical: 'https://example.com/',
          lang: 'en',
          ogLocale: 'en_US',
          alternates: enAlternates,
        }),
      },
      {
        route: '/fr',
        locale: 'fr',
        file: 'fr/index.html',
        meta: pageMeta({
          title: 'Accueil',
          canonical: 'https://example.com/fr/',
          lang: 'fr',
          ogLocale: 'fr_FR',
          alternates: frAlternates,
        }),
      },
    ]);
    assert.deepEqual(findings.errors, []);
    const hreflangWarnings = findings.warnings.filter(
      (finding) => finding.rule.startsWith('hreflang') || finding.rule.startsWith('html-lang'),
    );
    assert.deepEqual(hreflangWarnings, []);
  });

  it('reports invalid, duplicate, missing self and missing x-default links', () => {
    const findings = hreflangFindings([
      {
        route: '/fr',
        locale: 'fr',
        file: 'fr/index.html',
        meta: pageMeta({
          canonical: 'https://example.com/fr/',
          lang: 'fr',
          ogLocale: 'fr_FR',
          alternates: [
            { hreflang: 'not a locale', href: 'https://example.com/' },
            { hreflang: 'en', href: 'https://example.com/' },
            { hreflang: 'en', href: 'https://example.com/' },
          ],
        }),
      },
    ]);
    const rules = findings.errors.map((finding) => finding.rule);
    assert.ok(rules.includes('hreflang-invalid'));
    assert.ok(rules.includes('hreflang-duplicate'));
    assert.ok(findings.warnings.some((finding) => finding.rule === 'hreflang-missing-self'));
    assert.ok(findings.warnings.some((finding) => finding.rule === 'hreflang-missing-x-default'));
  });

  it('reports a one-way hreflang link', () => {
    const sourceAlternates = [
      { hreflang: 'en', href: 'https://example.com/' },
      { hreflang: 'fr', href: 'https://example.com/fr/' },
      { hreflang: 'x-default', href: 'https://example.com/' },
    ];
    const findings = hreflangFindings([
      {
        route: '/',
        locale: 'en',
        file: 'index.html',
        meta: pageMeta({
          title: 'Home',
          canonical: 'https://example.com/',
          lang: 'en',
          ogLocale: 'en_US',
          alternates: sourceAlternates,
        }),
      },
      {
        route: '/fr',
        locale: 'fr',
        file: 'fr/index.html',
        meta: pageMeta({
          title: 'Accueil',
          canonical: 'https://example.com/fr/',
          lang: 'fr',
          ogLocale: 'fr_FR',
          alternates: [
            { hreflang: 'fr', href: 'https://example.com/fr/' },
            { hreflang: 'x-default', href: 'https://example.com/' },
          ],
        }),
      },
    ]);
    assert.ok(findings.errors.some((finding) => finding.rule === 'hreflang-missing-return'));
  });

  it('reports html lang against the active locale', () => {
    const findings = hreflangFindings([
      {
        route: '/fr',
        locale: 'fr',
        file: 'fr/index.html',
        meta: pageMeta({
          canonical: 'https://example.com/fr/',
          lang: 'en',
          ogLocale: 'fr_FR',
          alternates: [
            { hreflang: 'fr', href: 'https://example.com/fr/' },
            { hreflang: 'x-default', href: 'https://example.com/' },
          ],
        }),
      },
    ]);
    assert.ok(findings.warnings.some((finding) => finding.rule === 'html-lang-mismatch'));
    assert.ok(findings.warnings.some((finding) => finding.rule === 'og-locale-missing') === false);
  });
});
