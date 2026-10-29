import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectPageMeta } from '../../src/core/page-meta.js';

function html({ head = '', body = '' }) {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('collectPageMeta', () => {
  it('reads the document metadata and structural markers', () => {
    const meta = collectPageMeta(
      html({
        head: [
          '<title>Orbital network</title>',
          '<meta name="description" content="Low-latency inference">',
          '<meta name="robots" content="noindex, follow">',
          '<link rel="canonical" href="https://example.com/network/">',
          '<link rel="alternate" hreflang="en" href="https://example.com/en/network/">',
          '<link rel="alternate" hreflang="en" href="https://example.com/en/network/">',
        ].join(''),
        body: '<h1>Network</h1><img src="/hero.png"><img src="data:image/png;base64,AA">',
      }),
    );
    assert.equal(meta.title, 'Orbital network');
    assert.equal(meta.titleCount, 1);
    assert.equal(meta.description, 'Low-latency inference');
    assert.equal(meta.robots, 'noindex, follow');
    assert.equal(meta.noindex, true);
    assert.equal(meta.canonical, 'https://example.com/network/');
    assert.equal(meta.h1Count, 1);
    assert.deepEqual(meta.images, ['/hero.png']);
    assert.deepEqual(meta.alternates, [
      { hreflang: 'en', href: 'https://example.com/en/network/' },
    ]);
  });

  it('does not treat an SVG title as the document title', () => {
    const meta = collectPageMeta(
      html({
        head: '<title>Page</title>',
        body: '<svg role="img"><title>Satellite</title></svg>',
      }),
    );
    assert.equal(meta.title, 'Page');
    assert.equal(meta.titleCount, 1);
  });

  it('counts duplicate titles and inline style attributes', () => {
    const meta = collectPageMeta(
      html({
        head: '<title>One</title><title>Two</title>',
        body: '<div style="color:red"><span style="">empty</span></div>',
      }),
    );
    assert.equal(meta.titleCount, 2);
    assert.equal(meta.title, 'One');
    assert.equal(meta.inlineStyleAttributes, 1);
  });

  it('collects responsive image candidates for the sitemap', () => {
    const meta = collectPageMeta(
      html({
        body: [
          '<img src="/hero.png" srcset="/hero-400.png 400w, /hero-800.png 800w">',
          '<picture><source srcset="/hero.webp 1x"><img src="/fallback.png"></picture>',
          '<img src="data:image/png;base64,AA">',
        ].join(''),
      }),
    );
    assert.deepEqual(meta.images, [
      '/hero.png',
      '/hero-400.png',
      '/hero-800.png',
      '/hero.webp',
      '/fallback.png',
    ]);
  });

  it('reports missing values as absent rather than inventing them', () => {
    const meta = collectPageMeta(html({}));
    assert.equal(meta.title, null);
    assert.equal(meta.description, null);
    assert.equal(meta.canonical, null);
    assert.equal(meta.noindex, false);
    assert.equal(meta.h1Count, 0);
  });
});
