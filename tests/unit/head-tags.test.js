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
  it('applies the title template and keeps the title unique when it already has the site name', () => {
    assert.equal(
      byKey(buildHeadEntries({ title: 'Awards' }, defaults)).get('title').text,
      'Awards | PPS',
    );
    assert.equal(
      byKey(buildHeadEntries({ title: 'PPS history' }, defaults)).get('title').text,
      'PPS history',
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

  it('applies the base path and the trailing slash convention', () => {
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
      buildHeadEntries({ canonical: '/awards' }, { ...defaults, trailingSlash: 'always' }),
    );
    assert.equal(always.get('link:rel:canonical').attrs.href, 'https://pps.example/awards/');

    const preserved = byKey(
      buildHeadEntries({ canonical: '/awards/' }, { ...defaults, trailingSlash: 'preserve' }),
    );
    assert.equal(preserved.get('link:rel:canonical').attrs.href, 'https://pps.example/awards/');
  });

  it('keeps an absolute URL as given', () => {
    const entries = byKey(buildHeadEntries({ canonical: 'https://elsewhere.example/x' }, defaults));
    assert.equal(entries.get('link:rel:canonical').attrs.href, 'https://elsewhere.example/x');
  });

  it('passes through extra tags and robots', () => {
    const entries = byKey(
      buildHeadEntries(
        {
          robots: 'noindex',
          extra: [
            { name: 'keywords', content: 'polymer' },
            { rel: 'alternate', href: '/feed.xml' },
          ],
        },
        defaults,
      ),
    );
    assert.equal(entries.get('meta:name:robots').attrs.content, 'noindex');
    assert.equal(entries.get('meta:name:keywords').attrs.content, 'polymer');
    assert.equal(entries.get('link:rel:alternate').attrs.href, '/feed.xml');
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
