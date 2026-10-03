import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSitemap, publicPath, withSitemapDirective } from '../../src/core/sitemap.js';

const config = (overrides = {}) => ({
  base: '/',
  notFoundRoute: '/404',
  metadata: { siteUrl: 'https://example.com' },
  ...overrides,
});

const files = (...entries) =>
  entries.map(([route, file, status = 'written']) => ({ route, file, status }));

describe('publicPath', () => {
  it('maps output files to the paths a host serves', () => {
    assert.equal(publicPath('index.html'), '/');
    assert.equal(publicPath('about/index.html'), '/about/');
    assert.equal(publicPath('blog/post/index.html'), '/blog/post/');
    assert.equal(publicPath('about.html'), '/about.html');
  });
});

describe('buildSitemap', () => {
  it('lists every written page with the site URL and lastmod', () => {
    const sitemap = buildSitemap({
      files: files(['/', 'index.html'], ['/about', 'about/index.html'], ['/404', '404.html']),
      config: config(),
      generatedAt: new Date('2026-10-01T12:00:00Z'),
    });

    assert.equal(sitemap.routes, 2);
    assert.match(sitemap.contents, /<loc>https:\/\/example\.com\/<\/loc>/);
    assert.match(sitemap.contents, /<loc>https:\/\/example\.com\/about\/<\/loc>/);
    assert.match(sitemap.contents, /<lastmod>2026-10-01<\/lastmod>/);
    assert.equal(sitemap.contents.includes('404.html'), false);
  });

  it('applies the base path and skips files that are not pages', () => {
    const sitemap = buildSitemap({
      files: files(['/', 'index.html'], ['/', 'snappy/state-abc.js'], ['/a', 'a.png']),
      config: config({ base: '/app/' }),
    });

    assert.equal(sitemap.routes, 1);
    assert.match(sitemap.contents, /<loc>https:\/\/example\.com\/app\/<\/loc>/);
  });

  it('returns null without a public site URL or without pages', () => {
    assert.equal(
      buildSitemap({ files: files(['/', 'index.html']), config: config({ metadata: {} }) }),
      null,
    );
    assert.equal(buildSitemap({ files: [], config: config() }), null);
  });

  it('escapes characters that would break the XML', () => {
    const sitemap = buildSitemap({
      files: files(['/a&b', 'a&b/index.html']),
      config: config(),
    });
    assert.match(sitemap.contents, /<loc>https:\/\/example\.com\/a&amp;b\/<\/loc>/);
  });
});

describe('withSitemapDirective', () => {
  it('appends the sitemap location when robots.txt does not mention one', () => {
    const patched = withSitemapDirective(
      'User-agent: *\nDisallow:\n',
      'https://example.com/sitemap.xml',
    );
    assert.match(patched, /User-agent: \*/);
    assert.match(patched, /Sitemap: https:\/\/example\.com\/sitemap\.xml/);
  });

  it('leaves a robots.txt that already points at a sitemap alone', () => {
    assert.equal(
      withSitemapDirective(
        'Sitemap: https://elsewhere.example/s.xml\n',
        'https://example.com/sitemap.xml',
      ),
      null,
    );
  });

  it('handles a file without a trailing newline', () => {
    const patched = withSitemapDirective('User-agent: *', 'https://example.com/sitemap.xml');
    assert.match(patched, /User-agent: \*\nSitemap: /);
  });
});
