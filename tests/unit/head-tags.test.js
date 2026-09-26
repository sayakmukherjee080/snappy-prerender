import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildHeadEntries,
  findBuildOriginUrls,
  headKey,
  mergeHeadEntries,
} from '../../src/head/tags.js';

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
});
