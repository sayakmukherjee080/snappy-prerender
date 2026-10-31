import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { launchBrowser } from '../../src/core/browser.js';
import { resolveConfig } from '../../src/core/config.js';
import { prerender } from '../../src/core/index.js';
import { startStaticServer } from '../../src/core/server.js';
import { cleanup, makeStaticSite } from './support.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, '..', 'fixtures');

after(cleanup);

describe('prerender integration: head SEO depth', () => {
  let sourceDir;

  before(async () => {
    const root = path.join(fixtureRoot, 'react19-app');
    sourceDir = await makeStaticSite({});
    await build({ root, logLevel: 'silent', build: { outDir: sourceDir, emptyOutDir: true } });
  });

  it('writes JSON-LD, lang/dir, hreflang alternates and sitemap entries', async () => {
    const report = await prerender({
      sourceDir,
      include: ['/head'],
      metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
      sitemap: true,
      audit: false,
      verify: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    assert.equal(report.ok, true);

    const html = await fs.readFile(path.join(sourceDir, 'head', 'index.html'), 'utf8');
    assert.match(html, /<html[^>]*lang="en"[^>]*dir="ltr"|<html[^>]*dir="ltr"[^>]*lang="en"/);
    assert.match(html, /<script[^>]*type="application\/ld\+json"[^>]*>/);
    assert.match(html, /"@context":"https:\/\/schema\.org"/);
    assert.equal(
      html.includes('rel="alternate" hreflang="en" href="https://example.com/head/"'),
      true,
    );
    assert.equal(
      html.includes('rel="alternate" hreflang="x-default" href="https://example.com/head/"'),
      true,
    );
    assert.equal(html.includes('rel="canonical" href="https://example.com/head/"'), true);

    const sitemap = await fs.readFile(path.join(sourceDir, 'sitemap.xml'), 'utf8');
    assert.match(sitemap, /xmlns:xhtml=/);
    assert.match(sitemap, /hreflang="en" href="https:\/\/example\.com\/head\/"/);
    assert.deepEqual(report.sitemap.locs, ['https://example.com/head/']);
  });

  it('keeps the head metadata out of the body', async () => {
    const html = await fs.readFile(path.join(sourceDir, 'head', 'index.html'), 'utf8');
    const body = html.slice(html.indexOf('<body'));
    assert.equal(body.includes('application/ld+json'), false);
    assert.equal(body.includes('rel="alternate"'), false);
  });

  it('does not duplicate alternates when the same route is rendered again', async () => {
    await prerender({
      sourceDir,
      include: ['/head'],
      metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
      sitemap: true,
      audit: false,
      verify: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    const html = await fs.readFile(path.join(sourceDir, 'head', 'index.html'), 'utf8');
    assert.equal(html.match(/hreflang="en"/g).length, 1);
    assert.equal(html.match(/hreflang="x-default"/g).length, 1);
    assert.equal(html.match(/application\/ld\+json/g).length, 1);
  });

  it('writes arbitrary tags, element attributes and multiple social values', async () => {
    const report = await prerender({
      sourceDir,
      include: ['/head-extras'],
      metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
      audit: false,
      verify: true,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    assert.equal(report.ok, true);
    assert.equal(
      report.verification.routes.find((entry) => entry.route === '/head-extras').mode,
      'hydrated',
    );

    const html = await fs.readFile(path.join(sourceDir, 'head-extras', 'index.html'), 'utf8');
    assert.match(html, /<html[^>]*lang="fr"[^>]*data-theme="dark"/);
    assert.match(html, /<body[^>]*class="extras"[^>]*data-scroll="locked"/);
    assert.match(html, /<title[^>]*itemprop="name"[^>]*>Extras head<\/title>/);
    assert.match(html, /<base[^>]*href="\/"/);
    assert.match(html, /<style[^>]*media="screen"[^>]*>body\{color:red\}<\/style>/);
    assert.match(html, /<noscript[^>]*><img src="\/pixel\.png" alt=""><\/noscript>/);
    assert.equal(html.includes('{"extras":true,"closing":"<\\/script>"}'), true);
    assert.match(
      html,
      /<script[^>]*type="application\/json"[^>]*>\{"extras":true,"closing":"<\\\/script>"\}<\/script>/,
    );

    assert.equal((html.match(/property="og:image"/g) ?? []).length, 2);
    assert.match(html, /property="og:image" content="https:\/\/example\.com\/share-19\.png"/);
    assert.match(html, /property="og:image" content="https:\/\/example\.com\/share-19-b\.png"/);
    assert.equal((html.match(/property="og:locale:alternate"/g) ?? []).length, 2);
    assert.match(html, /property="og:locale:alternate" content="en_US"/);
    assert.match(html, /property="og:locale:alternate" content="de_DE"/);
    assert.match(html, /name="twitter:image" content="https:\/\/example\.com\/share-19\.png"/);
  });

  it('adopts React 19 native head tags instead of duplicating them', async () => {
    const report = await prerender({
      sourceDir,
      include: ['/native-head'],
      metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
      audit: false,
      verify: true,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    assert.equal(report.ok, true);
    assert.equal(
      report.verification.routes.find((entry) => entry.route === '/native-head').mode,
      'hydrated',
    );
    const html = await fs.readFile(path.join(sourceDir, 'native-head', 'index.html'), 'utf8');
    assert.equal((html.match(/<title/g) ?? []).length, 1);
    assert.equal((html.match(/name="description"/g) ?? []).length, 1);
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
    assert.match(html, /<title[^>]*>Native and Head<\/title>/);
    assert.match(html, /name="description" content="Native description"/);
    assert.match(html, /rel="canonical" href="https:\/\/example\.com\/native-head\/"/);
  });

  it('navigates away from a React 19 native title without removing a node React owns', async () => {
    await prerender({
      sourceDir,
      include: ['/native-head', '/head'],
      crawl: false,
      metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
      audit: false,
      verify: false,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
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
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    try {
      await page.goto(`${server.origin}/native-head/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForFunction(() => document.title === 'Native and Head');
      assert.equal(await page.locator('head title').count(), 1);

      await page.getByRole('button', { name: 'Go to head' }).click();
      await page.waitForFunction(() => document.title === 'Nineteen head');
      assert.equal(await page.locator('head title').count(), 1);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
      await browser.close();
      await server.close();
    }
  });

  it('fills the document title from defaultTitle', async () => {
    const report = await prerender({
      sourceDir,
      include: ['/default-title'],
      audit: false,
      verify: true,
      logLevel: 'silent',
      captureFormState: false,
      captureRuntimeStyles: false,
    });
    assert.equal(report.ok, true);
    const html = await fs.readFile(path.join(sourceDir, 'default-title', 'index.html'), 'utf8');
    assert.match(html, /<title[^>]*>Fixture default title<\/title>/);
    assert.equal(
      report.verification.routes.find((entry) => entry.route === '/default-title').mode,
      'hydrated',
    );
  });
});
