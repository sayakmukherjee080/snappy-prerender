import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPreloadManifest, collectPageResources } from '../../src/core/preload-manifest.js';

describe('buildPreloadManifest', () => {
  it('builds Link header values for scripts and styles', () => {
    const manifest = buildPreloadManifest([
      { route: '/', scripts: ['/assets/app.js'], styles: ['/assets/app.css'] },
    ]);
    assert.deepEqual(manifest, [
      {
        source: '/',
        headers: [
          {
            key: 'Link',
            value: '</assets/app.js>;rel=preload;as=script,</assets/app.css>;rel=preload;as=style',
          },
        ],
      },
    ]);
  });

  it('filters ignored file names out of the hints', () => {
    const manifest = buildPreloadManifest(
      [{ route: '/', scripts: ['/service-worker.js', '/assets/app.js'], styles: [] }],
      { ignoreForPreload: ['service-worker.js'] },
    );
    assert.equal(manifest[0].headers[0].value, '</assets/app.js>;rel=preload;as=script');
  });

  it('skips routes that have nothing preloadable left', () => {
    assert.deepEqual(buildPreloadManifest([{ route: '/', scripts: [], styles: [] }]), []);
    assert.deepEqual(
      buildPreloadManifest([{ route: '/', scripts: ['/service-worker.js'], styles: [] }], {
        ignoreForPreload: ['service-worker.js'],
      }),
      [],
    );
  });

  it('prefixes hints and route keys with the base path', () => {
    const manifest = buildPreloadManifest(
      [{ route: '/about', scripts: ['/assets/app.js'], styles: ['/assets/app.css'] }],
      { base: '/app/' },
    );
    assert.equal(manifest[0].source, '/app/about/');
    assert.equal(
      manifest[0].headers[0].value,
      '</app/assets/app.js>;rel=preload;as=script,</app/assets/app.css>;rel=preload;as=style',
    );
  });

  it('uses a flat route key without a trailing slash', () => {
    const manifest = buildPreloadManifest(
      [{ route: '/about', scripts: ['/assets/app.js'], styles: [] }],
      { flatOutput: true },
    );
    assert.equal(manifest[0].source, '/about');
  });

  it('skips the not-found route because its file is not served at that URL', () => {
    const manifest = buildPreloadManifest(
      [
        { route: '/', scripts: ['/assets/app.js'], styles: [] },
        { route: '/404', scripts: ['/assets/app.js'], styles: [] },
      ],
      { notFoundRoute: '/404' },
    );
    assert.deepEqual(
      manifest.map((entry) => entry.source),
      ['/'],
    );
  });
});

describe('collectPageResources', () => {
  it('reads the resources the final HTML still references', () => {
    const html = [
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="/assets/app.css">',
      '<link rel="preload" as="image" href="/hero.png">',
      '<style data-snappy-inline>.a{}</style>',
      '</head><body>',
      '<script type="module" src="/assets/app.js"></script>',
      '<script data-snappy-state src="/snappy/state-abc.js"></script>',
      '<script>inline()</script>',
      '</body></html>',
    ].join('');
    assert.deepEqual(collectPageResources(html), {
      scripts: ['/assets/app.js', '/snappy/state-abc.js'],
      styles: ['/assets/app.css'],
    });
  });

  it('strips the base path and ignores external resources', () => {
    const html = [
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="/app/assets/app.css">',
      '<link rel="stylesheet" href="https://cdn.example/x.css">',
      '</head><body><script src="/app/assets/app.js"></script>',
      '<script src="https://cdn.example/x.js"></script></body></html>',
    ].join('');
    assert.deepEqual(collectPageResources(html, { base: '/app/', route: '/about' }), {
      scripts: ['/assets/app.js'],
      styles: ['/assets/app.css'],
    });
  });
});
