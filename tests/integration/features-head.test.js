import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { prerender } from '../../src/core/index.js';
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
});
