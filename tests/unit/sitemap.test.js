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
  it('lists every written page without a misleading lastmod', () => {
    const sitemap = buildSitemap({
      files: files(['/', 'index.html'], ['/about', 'about/index.html'], ['/404', '404.html']),
      config: config(),
    });

    assert.equal(sitemap.routes, 2);
    const contents = sitemap.files[0].contents;
    assert.match(contents, /<loc>https:\/\/example\.com\/<\/loc>/);
    assert.match(contents, /<loc>https:\/\/example\.com\/about\/<\/loc>/);
    assert.equal(contents.includes('<lastmod>'), false);
    assert.equal(contents.includes('404.html'), false);
  });

  it('uses a locale-specific URL when one is provided', () => {
    const sitemap = buildSitemap({
      files: [
        {
          route: '/fr',
          file: 'fr/index.html',
          status: 'written',
          localeUrl: 'https://fr.example.com/fr/',
        },
      ],
      config: config(),
    });
    assert.match(sitemap.files[0].contents, /<loc>https:\/\/fr\.example\.com\/fr\/<\/loc>/);
  });

  it('applies the base path and skips files that are not pages', () => {
    const sitemap = buildSitemap({
      files: files(['/', 'index.html'], ['/', 'snappy/state-abc.js'], ['/a', 'a.png']),
      config: config({ base: '/app/' }),
    });

    assert.equal(sitemap.routes, 1);
    assert.match(sitemap.files[0].contents, /<loc>https:\/\/example\.com\/app\/<\/loc>/);
  });

  it('skips pages that declare noindex', () => {
    const sitemap = buildSitemap({
      files: [
        { route: '/', file: 'index.html', status: 'written' },
        { route: '/private', file: 'private/index.html', status: 'written', noindex: true },
      ],
      config: config(),
    });
    assert.equal(sitemap.routes, 1);
    assert.equal(sitemap.files[0].contents.includes('/private/'), false);
  });

  it('uses the same flat and trailing slash policy as canonical URLs', () => {
    const flat = buildSitemap({
      files: files(['/', 'index.html'], ['/about', 'about.html']),
      config: config({ flatOutput: true }),
    });
    assert.match(flat.files[0].contents, /<loc>https:\/\/example\.com\/about<\/loc>/);

    const never = buildSitemap({
      files: files(['/about', 'about/index.html']),
      config: config({ metadata: { siteUrl: 'https://example.com', trailingSlash: 'never' } }),
    });
    assert.match(never.files[0].contents, /<loc>https:\/\/example\.com\/about<\/loc>/);
  });

  it('splits more than maxUrls entries into a sitemap index', () => {
    const sitemap = buildSitemap({
      files: files(['/a', 'a/index.html'], ['/b', 'b/index.html'], ['/c', 'c/index.html']),
      config: config(),
      maxUrls: 2,
    });
    assert.deepEqual(
      sitemap.files.map((entry) => entry.name),
      ['sitemap.xml', 'sitemap-1.xml', 'sitemap-2.xml'],
    );
    assert.match(sitemap.files[0].contents, /<sitemapindex/);
    assert.match(sitemap.files[0].contents, /sitemap-1\.xml/);
    assert.equal(sitemap.routes, 3);
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
    assert.match(sitemap.files[0].contents, /<loc>https:\/\/example\.com\/a&amp;b\/<\/loc>/);
  });

  it('adds hreflang alternates and reports the listed locs', () => {
    const sitemap = buildSitemap({
      files: [
        {
          route: '/seo',
          file: 'seo/index.html',
          status: 'written',
          alternates: [
            { hreflang: 'en', href: 'https://example.com/en/seo/' },
            { hreflang: 'x-default', href: '/seo/' },
            { hreflang: 'en', href: 'https://example.com/en/seo/' },
          ],
        },
      ],
      config: config(),
    });
    const contents = sitemap.files[0].contents;
    assert.match(contents, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assert.match(contents, /hreflang="en" href="https:\/\/example\.com\/en\/seo\/"/);
    assert.match(contents, /hreflang="x-default" href="https:\/\/example\.com\/seo\/"/);
    assert.equal(contents.match(/hreflang="en"/g).length, 1);
    assert.deepEqual(sitemap.locs, ['https://example.com/seo/']);
  });

  it('adds same-origin images only when the image sitemap is enabled', () => {
    const entry = {
      route: '/',
      file: 'index.html',
      status: 'written',
      images: ['/hero.png', 'https://cdn.example.net/remote.png', '/hero.png'],
    };
    const disabled = buildSitemap({ files: [entry], config: config() });
    assert.equal(disabled.files[0].contents.includes('image:image'), false);

    const enabled = buildSitemap({
      files: [entry],
      config: config({ imageSitemap: true }),
    });
    const contents = enabled.files[0].contents;
    assert.match(contents, /xmlns:image=/);
    assert.equal(contents.includes('https://example.com/hero.png'), true);
    assert.equal(contents.includes('cdn.example.net'), false);
    assert.equal(contents.match(/<image:loc>/g).length, 1);
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
