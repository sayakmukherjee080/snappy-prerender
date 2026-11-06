import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite, page } from './support.js';

const baselineDirs = [];
after(async () => {
  for (const dir of baselineDirs) await fs.rm(dir, { recursive: true, force: true });
  await cleanup();
});

const options = (sourceDir, baselinePath, overrides = {}) => ({
  sourceDir,
  baselinePath,
  include: ['/', '/about'],
  crawl: false,
  drift: true,
  verify: false,
  audit: false,
  logLevel: 'silent',
  captureFormState: false,
  captureRuntimeStyles: false,
  ...overrides,
});

describe('prerender integration: content drift', () => {
  it('creates a baseline, reports additions, changes and removals, and gates removal', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Alpha', ['/about']),
      'about/index.html': page('About'),
    });
    const baselineDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-baseline-'));
    baselineDirs.push(baselineDir);
    const baselinePath = path.join(baselineDir, 'baseline.json');

    const first = await prerender(options(sourceDir, baselinePath));
    assert.equal(first.drift.baseline.state, 'created');
    assert.equal(first.drift.added.length, 0);
    assert.equal(first.drift.unchanged, 2);

    const second = await prerender(options(sourceDir, baselinePath));
    assert.equal(second.drift.baseline.state, 'compared');
    assert.equal(second.drift.unchanged, 2);
    assert.equal(second.drift.changed.length, 0);

    await fs.mkdir(path.join(sourceDir, 'new'), { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'new', 'index.html'), page('New'));
    const third = await prerender(
      options(sourceDir, baselinePath, {
        include: ['/', '/about', '/new'],
        transformHtml: (html, { route }) => (route === '/' ? html.replace('Alpha', 'Beta') : html),
      }),
    );
    assert.equal(
      third.drift.added.some((entry) => entry.route === '/new'),
      true,
    );
    assert.equal(
      third.drift.changed.some((entry) => entry.route === '/' && entry.reasons.includes('content')),
      true,
    );

    const baselineBeforeFailure = await fs.readFile(baselinePath, 'utf8');
    const fourth = await prerender(
      options(sourceDir, baselinePath, {
        include: ['/', '/new'],
        failOnDrift: ['removed'],
      }),
    );
    assert.equal(
      fourth.drift.removed.some((entry) => entry.route === '/about'),
      true,
    );
    assert.equal(fourth.ok, false);
    assert.deepEqual(fourth.drift.failures, [{ status: 'removed', count: 1 }]);
    assert.equal(await fs.readFile(baselinePath, 'utf8'), baselineBeforeFailure);
  });

  it('does not write a baseline in dry-run mode', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Alpha') });
    const baselineDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-baseline-'));
    baselineDirs.push(baselineDir);
    const baselinePath = path.join(baselineDir, 'baseline.json');
    const initial = await prerender(options(sourceDir, baselinePath, { include: ['/'] }));
    assert.equal(initial.drift.baseline.state, 'created');
    const before = await fs.readFile(baselinePath, 'utf8');

    const dry = await prerender(
      options(sourceDir, baselinePath, {
        include: ['/'],
        dryRun: true,
        transformHtml: (html) => html.replace('Alpha', 'Beta'),
      }),
    );
    assert.equal(dry.drift.changed.length, 1);
    assert.deepEqual(dry.drift.baseline.state, 'compared');
    assert.equal(await fs.readFile(baselinePath, 'utf8'), before);
  });

  it('adds and preserves sitemap lastmod values from content hashes', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Alpha'),
      'about/index.html': page('About'),
    });
    const baselineDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-baseline-'));
    baselineDirs.push(baselineDir);
    const baselinePath = path.join(baselineDir, 'baseline.json');
    const sitemapOptions = {
      include: ['/', '/about'],
      drift: true,
      sitemap: true,
      sitemapLastmod: true,
      freezeTime: '2026-01-01T00:00:00.000Z',
      metadata: { siteUrl: 'https://example.com' },
    };

    const first = await prerender(options(sourceDir, baselinePath, sitemapOptions));
    assert.equal(first.sitemap.lastmod, 2);
    const firstXml = await fs.readFile(path.join(sourceDir, 'sitemap.xml'), 'utf8');
    assert.equal(firstXml.match(/<lastmod>/g).length, 2);
    const firstHome = lastmodFor(firstXml, 'https://example.com/');
    const firstAbout = lastmodFor(firstXml, 'https://example.com/about/');

    const second = await prerender(options(sourceDir, baselinePath, sitemapOptions));
    const secondXml = await fs.readFile(path.join(sourceDir, 'sitemap.xml'), 'utf8');
    assert.equal(lastmodFor(secondXml, 'https://example.com/'), firstHome);
    assert.equal(lastmodFor(secondXml, 'https://example.com/about/'), firstAbout);
    assert.equal(second.drift.changed.length, 0);

    const third = await prerender(
      options(sourceDir, baselinePath, {
        ...sitemapOptions,
        transformHtml: (html, { route }) => (route === '/' ? html.replace('Alpha', 'Beta') : html),
      }),
    );
    const thirdXml = await fs.readFile(path.join(sourceDir, 'sitemap.xml'), 'utf8');
    assert.notEqual(lastmodFor(thirdXml, 'https://example.com/'), firstHome);
    assert.equal(lastmodFor(thirdXml, 'https://example.com/about/'), firstAbout);
    assert.equal(third.drift.changed.length, 1);
  });
});

// Reads the lastmod that follows one loc in a generated sitemap.
function lastmodFor(xml, loc) {
  const match = xml.match(
    new RegExp(`<loc>${escapeRegExp(loc)}</loc>\\s*<lastmod>([^<]+)</lastmod>`),
  );
  return match?.[1] ?? null;
}

// Escapes a URL for the small sitemap assertion above.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
