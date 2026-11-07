import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cliOptions } from '../../src/cli-options.js';

describe('cliOptions drift and container flags', () => {
  it('maps the verification and drift flags without setting defaults', () => {
    const options = cliOptions({
      values: {
        container: '#app-root',
        drift: true,
        baseline: 'state/baseline.json',
        'fail-on-drift-status': 'removed,changed',
        'sitemap-lastmod': true,
      },
      positionals: [],
    });
    assert.equal(options.container, '#app-root');
    assert.equal(options.drift, true);
    assert.equal(options.baselinePath, 'state/baseline.json');
    assert.deepEqual(options.failOnDrift, ['removed', 'changed']);
    assert.equal(options.sitemapLastmod, true);
  });

  it('maps --fail-on-drift to the safe default gate', () => {
    const options = cliOptions({ values: { 'fail-on-drift': true }, positionals: [] });
    assert.equal(options.failOnDrift, true);
  });

  it('leaves the new options absent when the flags are absent', () => {
    const options = cliOptions({ values: {}, positionals: [] });
    assert.equal(Object.hasOwn(options, 'container'), false);
    assert.equal(Object.hasOwn(options, 'drift'), false);
    assert.equal(Object.hasOwn(options, 'baselinePath'), false);
    assert.equal(Object.hasOwn(options, 'failOnDrift'), false);
    assert.equal(Object.hasOwn(options, 'sitemapLastmod'), false);
    assert.equal(Object.hasOwn(options, 'incremental'), false);
    assert.equal(Object.hasOwn(options, 'vendorAssets'), false);
  });

  it('maps incremental and vendoring flags', () => {
    const options = cliOptions({
      values: {
        incremental: true,
        'incremental-cache': '.cache/snappy.json',
        'incremental-max-age': '7d',
        'incremental-lock-timeout': '30s',
        'incremental-exclude': '/admin/*,/api/*',
        'incremental-data-hosts': 'api.example.com',
        'incremental-data-max-bytes': '1024',
        'vendor-assets': 'fonts.example.com,cdn.example.com',
        'vendor-asset-types': 'css,font,script',
        'vendor-asset-max-bytes': '2048',
        'vendor-asset-on-error': 'fail',
        'fail-on-external-assets': true,
      },
      positionals: [],
    });
    assert.equal(options.incremental.enabled, true);
    assert.equal(options.incremental.cachePath, '.cache/snappy.json');
    assert.equal(options.incremental.maxAge, '7d');
    assert.equal(options.incremental.lockTimeout, '30s');
    assert.deepEqual(options.incremental.exclude, ['/admin/*', '/api/*']);
    assert.deepEqual(options.incremental.data, { hosts: ['api.example.com'], maxBytes: 1024 });
    assert.deepEqual(options.vendorAssets.hosts, ['fonts.example.com', 'cdn.example.com']);
    assert.deepEqual(options.vendorAssets.types, ['css', 'font', 'script']);
    assert.equal(options.vendorAssets.maxBytes, 2048);
    assert.equal(options.vendorAssets.onError, 'fail');
    assert.equal(options.vendorAssets.failOnExternalAssets, true);
  });

  it('maps --incremental-trust to trust mode', () => {
    const options = cliOptions({
      values: { 'incremental-trust': true },
      positionals: [],
    });
    assert.equal(options.incremental.enabled, true);
    assert.equal(options.incremental.mode, 'trust');
  });
});
