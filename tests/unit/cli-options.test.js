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
  });
});
