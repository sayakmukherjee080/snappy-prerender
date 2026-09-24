import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPreloadManifest } from '../../src/core/preload-manifest.js';

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
});
