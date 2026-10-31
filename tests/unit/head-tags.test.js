import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findBuildOriginUrls } from '../../src/core/build-origin.js';
import { buildHeadEntries, headKey, mergeHeadEntries } from '../../src/head/tags.js';

const defaults = {
  siteUrl: 'https://pps.example',
  base: '/',
  siteName: 'PPS',
  titleTemplate: '%s | PPS',
  defaultImage: '/share.png',
  trailingSlash: 'never',
};

const byKey = (entries) => new Map(entries.map((entry) => [headKey(entry), entry]));

describe('buildHeadEntries', () => {
  it('applies the title template unless the title already carries its suffix', () => {
    assert.equal(
      byKey(buildHeadEntries({ title: 'Awards' }, defaults)).get('title').text,
      'Awards | PPS',
    );
    assert.equal(
      byKey(buildHeadEntries({ title: 'Awards | PPS' }, defaults)).get('title').text,
      'Awards | PPS',
    );
    assert.equal(byKey(buildHeadEntries({ title: 'PPS' }, defaults)).get('title').text, 'PPS');
    // A site name that merely appears inside a title is not a reason to skip the template.
    assert.equal(
      byKey(
        buildHeadEntries(
          { title: 'Awarding prizes' },
          { siteName: 'Award', titleTemplate: '%s | Award' },
        ),
      ).get('title').text,
      'Awarding prizes | Award',
    );
    assert.equal(byKey(buildHeadEntries({}, defaults)).has('title'), false);
  });

  it('builds the open graph and twitter tags with absolute URLs', () => {
    const entries = byKey(
      buildHeadEntries({ title: 'Awards', description: 'All awards', image: '/a.png' }, defaults),
    );
    assert.equal(entries.get('meta:property:og:title').attrs.content, 'Awards | PPS');
    assert.equal(entries.get('meta:property:og:type').attrs.content, 'website');
    assert.equal(entries.get('meta:property:og:site_name').attrs.content, 'PPS');
    assert.equal(entries.get('meta:property:og:image').attrs.content, 'https://pps.example/a.png');
    assert.equal(entries.get('meta:property:og:url').attrs.content, 'https://pps.example/');
    assert.equal(entries.get('meta:name:twitter:card').attrs.content, 'summary_large_image');
    assert.equal(entries.get('link:rel:canonical').attrs.href, 'https://pps.example/');
  });

  it('falls back to the default share image and lowers the twitter card without one', () => {
    const withDefault = byKey(buildHeadEntries({ title: 'Awards' }, defaults));
    assert.equal(
      withDefault.get('meta:property:og:image').attrs.content,
      'https://pps.example/share.png',
    );
    assert.equal(withDefault.get('meta:name:twitter:card').attrs.content, 'summary_large_image');

    const withoutImage = byKey(
      buildHeadEntries({ title: 'Awards' }, { ...defaults, defaultImage: null }),
    );
    assert.equal(withoutImage.has('meta:property:og:image'), false);
    assert.equal(withoutImage.get('meta:name:twitter:card').attrs.content, 'summary');
  });

  it('emits alternate Open Graph locales', () => {
    const entries = buildHeadEntries(
      { title: 'Awards', locale: 'fr_FR', alternateLocales: ['en_US', 'de_DE'] },
      defaults,
    );
    const byKeyMap = byKey(entries);
    assert.equal(byKeyMap.get('meta:property:og:locale').attrs.content, 'fr_FR');
    const alternates = entries.filter((entry) => entry.attrs?.property === 'og:locale:alternate');
    assert.deepEqual(
      alternates.map((entry) => entry.attrs.content),
      ['en_US', 'de_DE'],
    );
    assert.equal(new Set(alternates.map((entry) => headKey(entry))).size, 2);
  });

  it('respects switching open graph or twitter off', () => {
    const entries = byKey(
      buildHeadEntries({ title: 'Awards', openGraph: false, twitter: false }, defaults),
    );
    assert.equal(entries.has('meta:property:og:title'), false);
    assert.equal(entries.has('meta:name:twitter:card'), false);
    assert.equal(entries.get('title').text, 'Awards | PPS');
  });

  it('applies the base path and the trailing slash convention to page URLs only', () => {
    const based = byKey(
      buildHeadEntries(
        { title: 'Awards', canonical: '/awards', image: '/a.png' },
        { ...defaults, base: '/app/' },
      ),
    );
    assert.equal(based.get('link:rel:canonical').attrs.href, 'https://pps.example/app/awards');
    assert.equal(
      based.get('meta:property:og:image').attrs.content,
      'https://pps.example/app/a.png',
    );

    const always = byKey(
      buildHeadEntries(
        { canonical: '/awards', image: '/a.png' },
        { ...defaults, trailingSlash: 'always' },
      ),
    );
    assert.equal(always.get('link:rel:canonical').attrs.href, 'https://pps.example/awards/');
    assert.equal(always.get('meta:property:og:url').attrs.content, 'https://pps.example/awards/');
    // An image is a file, so the convention must not turn it into a directory path.
    assert.equal(always.get('meta:property:og:image').attrs.content, 'https://pps.example/a.png');

    const preserved = byKey(
      buildHeadEntries({ canonical: '/awards/' }, { ...defaults, trailingSlash: 'preserve' }),
    );
    assert.equal(preserved.get('link:rel:canonical').attrs.href, 'https://pps.example/awards/');
  });

  it('keeps an absolute URL as given', () => {
    const entries = byKey(buildHeadEntries({ canonical: 'https://elsewhere.example/x' }, defaults));
    assert.equal(entries.get('link:rel:canonical').attrs.href, 'https://elsewhere.example/x');
  });

  it('does not double the base path in the default canonical', () => {
    const previous = globalThis.location;
    globalThis.location = { pathname: '/app/about', origin: 'http://127.0.0.1:1234' };
    try {
      const entries = byKey(
        buildHeadEntries(
          { title: 'Awards' },
          { ...defaults, base: '/app/', trailingSlash: 'preserve' },
        ),
      );
      assert.equal(entries.get('link:rel:canonical').attrs.href, 'https://pps.example/app/about/');
      assert.equal(
        entries.get('meta:property:og:url').attrs.content,
        'https://pps.example/app/about/',
      );
    } finally {
      globalThis.location = previous;
    }
  });

  it('passes protocol-relative, non-http and spaced values through as usable URLs', () => {
    const relative = byKey(buildHeadEntries({ image: '//cdn.example/i.png' }, defaults));
    assert.equal(relative.get('meta:property:og:image').attrs.content, '//cdn.example/i.png');

    const dataUri = 'data:image/png;base64,AAAA';
    const inline = byKey(buildHeadEntries({ image: dataUri }, defaults));
    assert.equal(inline.get('meta:property:og:image').attrs.content, dataUri);

    const spaced = byKey(buildHeadEntries({ canonical: '/my page' }, defaults));
    assert.equal(spaced.get('link:rel:canonical').attrs.href, 'https://pps.example/my%20page');
  });

  it('passes through extra tags and robots', () => {
    const entries = byKey(
      buildHeadEntries(
        {
          robots: 'noindex',
          extra: [
            { name: 'keywords', content: 'polymer' },
            { rel: 'alternate', href: '/feed.xml' },
            { key: 'custom', name: 'x', content: 'y' },
          ],
        },
        defaults,
      ),
    );
    assert.equal(entries.get('meta:name:robots').attrs.content, 'noindex');
    assert.equal(entries.get('meta:name:keywords').attrs.content, 'polymer');
    assert.equal(entries.get('link:rel:alternate|/feed.xml').attrs.href, '/feed.xml');
    assert.equal(entries.get('meta:custom').attrs.content, 'y');
  });

  it('keeps links with the same rel but different hrefs apart', () => {
    const entries = buildHeadEntries({
      extra: [
        { rel: 'preload', as: 'font', href: '/a.woff2' },
        { rel: 'preload', as: 'font', href: '/b.woff2' },
      ],
    });
    const preloads = mergeHeadEntries([{ sequence: 1, entries }]).filter(
      (entry) => entry.attrs?.rel === 'preload',
    );
    assert.deepEqual(
      preloads.map((entry) => entry.attrs.href),
      ['/a.woff2', '/b.woff2'],
    );
  });

  it('builds JSON-LD scripts, html attributes and hreflang alternates', () => {
    const entries = buildHeadEntries(
      {
        title: 'Awards',
        lang: 'en',
        dir: 'ltr',
        structuredData: { '@context': 'https://schema.org', name: '</script><x>' },
        alternates: [
          { hreflang: 'en', href: '/en/awards' },
          { hreflang: 'x-default', href: '/awards' },
        ],
      },
      defaults,
      'head-1',
    );
    const byId = new Map(entries.map((entry) => [headKey(entry), entry]));
    assert.equal(byId.get('html:lang').value, 'en');
    assert.equal(byId.get('html:dir').value, 'ltr');
    const script = byId.get('script:ld+json:head-1');
    assert.equal(script.kind, 'script');
    assert.equal(script.attrs.type, 'application/ld+json');
    assert.equal(script.text.includes('\\u003C/script'), true);
    assert.match(script.text, /"@context":"https:\/\/schema\.org"/);
    assert.equal(
      byId.get('link:rel:alternate|en|https://pps.example/en/awards').attrs.hreflang,
      'en',
    );
    assert.equal(
      byId.get('link:rel:alternate|x-default|https://pps.example/awards').attrs.href,
      'https://pps.example/awards',
    );
  });

  it('keys structured data per Head so layout and page can both contribute', () => {
    const layout = buildHeadEntries({ structuredData: { name: 'Layout' } }, defaults, 'layout');
    const page = buildHeadEntries({ structuredData: { name: 'Page' } }, defaults, 'page');
    const merged = mergeHeadEntries([
      { sequence: 1, entries: layout },
      { sequence: 2, entries: page },
    ]);
    assert.equal(merged.filter((entry) => entry.kind === 'script').length, 2);
  });

  it('uses defaultTitle only when no title exists and never templates it', () => {
    assert.equal(
      byKey(buildHeadEntries({ defaultTitle: 'Example' }, defaults)).get('default-title').text,
      'Example',
    );
    assert.equal(
      byKey(buildHeadEntries({}, { ...defaults, defaultTitle: 'Metadata fallback' })).get(
        'default-title',
      ).text,
      'Metadata fallback',
    );
    assert.equal(
      byKey(buildHeadEntries({ title: 'Awards', defaultTitle: 'Example' }, defaults)).get('title')
        .text,
      'Awards | PPS',
    );
    assert.equal(
      byKey(buildHeadEntries({ defaultTitle: 'Example' }, defaults)).has('title'),
      false,
    );
    const merged = mergeHeadEntries([
      { sequence: 1, entries: buildHeadEntries({ defaultTitle: 'Example' }, defaults) },
      { sequence: 2, entries: buildHeadEntries({ title: 'Awards' }, defaults) },
    ]);
    assert.equal(merged.find((entry) => entry.kind === 'title').text, 'Awards | PPS');
  });

  it('merges html, body and title attributes with boolean values', () => {
    const entries = byKey(
      buildHeadEntries(
        {
          title: 'Awards',
          lang: 'en',
          htmlAttributes: {
            lang: 'fr',
            'data-theme': 'dark',
            hidden: true,
            'data-off': false,
            'data-count': 3,
          },
          bodyAttributes: { className: 'root', 'data-scroll': 'locked' },
          titleAttributes: { itemProp: 'name' },
        },
        defaults,
      ),
    );
    assert.equal(entries.get('html:lang').value, 'fr');
    assert.equal(entries.get('html:data-theme').value, 'dark');
    assert.equal(entries.get('html:hidden').value, '');
    assert.equal(entries.has('html:data-off'), false);
    assert.equal(entries.get('html:data-count').value, '3');
    assert.equal(entries.get('body:class').value, 'root');
    assert.equal(entries.get('body:data-scroll').value, 'locked');
    assert.equal(entries.get('title-attr:itemprop').value, 'name');
  });

  it('builds arbitrary script, style, noscript and base tags', () => {
    const entries = buildHeadEntries(
      {
        tags: [
          { tag: 'base', attrs: { href: '/', target: '_self' } },
          {
            tag: 'script',
            key: 'analytics',
            attrs: { src: '/analytics.js', async: true, defer: false },
          },
          { tag: 'script', attrs: { type: 'application/json' }, text: '{"ok":true}' },
          { tag: 'style', attrs: { media: 'screen' }, text: 'body{color:red}' },
          { tag: 'noscript', html: '<img src="/pixel.png" alt="">' },
        ],
      },
      defaults,
      'head-1',
    );
    const byKind = new Map(entries.map((entry) => [headKey(entry), entry]));
    assert.equal(byKind.get('base').attrs.href, '/');
    assert.equal(byKind.get('script:key:analytics').attrs.async, '');
    assert.equal(Object.hasOwn(byKind.get('script:key:analytics').attrs, 'defer'), false);
    assert.equal(byKind.get('script:inline:head-1:2').text, '{"ok":true}');
    assert.equal(byKind.get('style:inline:head-1:3').attrs.media, 'screen');
    assert.equal(byKind.get('noscript:inline:head-1:4').html, '<img src="/pixel.png" alt="">');
  });

  it('escapes closing tag sequences in script and style text', () => {
    const entries = new Map(
      buildHeadEntries(
        {
          tags: [
            { tag: 'script', text: 'window.value = "</script>";' },
            { tag: 'style', text: '/* </style> */ body { color: red }' },
          ],
        },
        defaults,
        'head-1',
      ).map((entry) => [headKey(entry), entry]),
    );
    assert.equal(entries.get('script:inline:head-1:0').text, 'window.value = "<\\/script>";');
    assert.equal(entries.get('style:inline:head-1:1').text, '/* <\\/style> */ body { color: red }');
    assert.equal(entries.get('script:inline:head-1:0').text.includes('</script>'), false);
  });

  it('keeps several inline scripts apart and rejects unsupported tags', () => {
    const entries = buildHeadEntries(
      {
        tags: [
          { tag: 'script', text: 'a' },
          { tag: 'script', text: 'b' },
        ],
      },
      defaults,
      'head-1',
    );
    const scripts = entries.filter((entry) => entry.kind === 'script');
    assert.equal(new Set(scripts.map((entry) => headKey(entry))).size, 2);
    assert.throws(
      () => buildHeadEntries({ tags: [{ tag: 'iframe', attrs: { src: '/x' } }] }, defaults),
      /tags\[0\]\.tag/,
    );
    assert.throws(
      () => buildHeadEntries({ tags: [{ tag: 'base', html: '<x>' }] }, defaults),
      /only supported on noscript/,
    );
    assert.throws(
      () =>
        buildHeadEntries(
          { tags: [{ tag: 'style', attrs: { 'data-snappy-head': 'x' } }] },
          defaults,
        ),
      /reserved/,
    );
    assert.throws(
      () => buildHeadEntries({ children: 'title' }, defaults),
      /does not accept children/,
    );
  });

  it('emits one Open Graph image per value and uses the first for Twitter', () => {
    const entries = buildHeadEntries({ images: ['/a.png', '/b.png'] }, defaults);
    const images = entries.filter((entry) => entry.attrs?.property === 'og:image');
    assert.deepEqual(
      images.map((entry) => entry.attrs.content),
      ['https://pps.example/a.png', 'https://pps.example/b.png'],
    );
    assert.equal(new Set(images.map((entry) => headKey(entry))).size, 2);
    assert.equal(
      entries.find((entry) => entry.attrs?.name === 'twitter:image').attrs.content,
      'https://pps.example/a.png',
    );
  });

  it('keeps duplicate extra meta tags when duplicates is set', () => {
    const entries = buildHeadEntries({
      extra: [
        { name: 'article:tag', content: 'alpha', duplicates: true },
        { name: 'article:tag', content: 'beta', duplicates: true },
      ],
    });
    const tags = entries.filter((entry) => entry.attrs?.name === 'article:tag');
    assert.deepEqual(
      tags.map((entry) => entry.attrs.content),
      ['alpha', 'beta'],
    );
    assert.equal(new Set(tags.map((entry) => headKey(entry))).size, 2);
    assert.equal(
      tags.every((entry) => !Object.hasOwn(entry.attrs, 'duplicates')),
      true,
    );
  });
});

describe('mergeHeadEntries', () => {
  it('lets the later rendered Head win for the same key', () => {
    const layout = {
      sequence: 1,
      entries: buildHeadEntries({ title: 'Layout', description: 'Layout default' }, defaults),
    };
    const page = {
      sequence: 2,
      entries: buildHeadEntries({ title: 'Page', robots: 'noindex' }, defaults),
    };
    const merged = byKey(mergeHeadEntries([page, layout]));
    assert.equal(merged.get('title').text, 'Page | PPS');
    assert.equal(merged.get('meta:name:description').attrs.content, 'Layout default');
    assert.equal(merged.get('meta:name:robots').attrs.content, 'noindex');
  });

  it('returns an empty list when nothing is mounted', () => {
    assert.deepEqual(mergeHeadEntries([]), []);
  });

  it('collapses canonical to one tag while keeping same-rel links apart', () => {
    const layout = {
      sequence: 1,
      entries: buildHeadEntries({
        canonical: 'https://a.example/x',
        extra: [
          { rel: 'preload', as: 'font', href: '/a.woff2' },
          { rel: 'preload', as: 'font', href: '/b.woff2' },
        ],
      }),
    };
    const page = { sequence: 2, entries: buildHeadEntries({ canonical: 'https://a.example/y' }) };
    const merged = mergeHeadEntries([layout, page]);
    const canonicals = merged.filter((entry) => entry.attrs?.rel === 'canonical');
    assert.equal(canonicals.length, 1);
    assert.equal(canonicals[0].attrs.href, 'https://a.example/y');
    assert.equal(merged.filter((entry) => entry.attrs?.rel === 'preload').length, 2);
  });

  it('lets a later Head override an http-equiv meta instead of duplicating it', () => {
    const layout = {
      sequence: 1,
      entries: buildHeadEntries({ extra: [{ 'http-equiv': 'refresh', content: '30' }] }),
    };
    const page = {
      sequence: 2,
      entries: buildHeadEntries({ extra: [{ 'http-equiv': 'refresh', content: '5' }] }),
    };
    const refreshes = mergeHeadEntries([layout, page]).filter(
      (entry) => entry.attrs?.['http-equiv'] === 'refresh',
    );
    assert.equal(refreshes.length, 1);
    assert.equal(refreshes[0].attrs.content, '5');
  });
});

describe('findBuildOriginUrls', () => {
  it('finds and de-duplicates build server origins in metadata', () => {
    const html =
      '<head><meta property="og:url" content="http://127.0.0.1:5500/a">' +
      '<meta property="og:image" content="http://localhost:5500/x.png">' +
      '<link rel="canonical" href="http://127.0.0.1:5500/a"></head>';
    assert.deepEqual(findBuildOriginUrls(html), ['http://127.0.0.1:5500', 'http://localhost:5500']);
  });

  it('returns nothing for public metadata', () => {
    assert.deepEqual(
      findBuildOriginUrls('<meta property="og:url" content="https://pps.example/a">'),
      [],
    );
  });

  it('ignores loopback URLs outside metadata tags', () => {
    const html =
      '<!doctype html><html><head><meta property="og:title" content="A"></head>' +
      '<body><script>window.api = "http://127.0.0.1:5500/api";</script></body></html>';
    assert.deepEqual(findBuildOriginUrls(html), []);
  });
});
