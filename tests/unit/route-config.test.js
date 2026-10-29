import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveConfig } from '../../src/core/config.js';
import { resolveRouteConfig } from '../../src/core/route-config.js';

describe('resolveRouteConfig', () => {
  const config = resolveConfig({
    timeout: 30000,
    crawl: true,
    routeOverrides: [
      { match: '/pricing', timeout: 60000, waitFor: '.calculator' },
      { match: /^\/company/, crawl: false },
      { match: '/pricing', readySelector: '#ready' },
    ],
  });

  it('applies matching overrides in order, with later entries winning', () => {
    const priced = resolveRouteConfig(config, '/pricing');
    assert.equal(priced.timeout, 60000);
    assert.equal(priced.waitFor, '.calculator');
    assert.equal(priced.readySelector, '#ready');
    assert.equal(priced.crawl, true);
  });

  it('applies a RegExp match only to matching routes', () => {
    assert.equal(resolveRouteConfig(config, '/company/team').crawl, false);
    assert.equal(resolveRouteConfig(config, '/network').crawl, true);
  });

  it('does not mutate the base config', () => {
    resolveRouteConfig(config, '/pricing');
    assert.equal(config.timeout, 30000);
    assert.equal(config.waitFor, null);
  });

  it('ignores undefined override values instead of clearing base settings', () => {
    const withUndefined = resolveConfig({
      timeout: 30000,
      crawl: true,
      routeOverrides: [{ match: '/', timeout: undefined, crawl: undefined, waitFor: undefined }],
    });
    const resolved = resolveRouteConfig(withUndefined, '/');
    assert.equal(resolved.timeout, 30000);
    assert.equal(resolved.crawl, true);
    assert.equal(resolved.waitFor, null);
  });

  it('rejects an override key the resolver does not know', () => {
    assert.throws(
      () => resolveConfig({ routeOverrides: [{ match: '/', timeout: 1, nope: true }] }),
      /not a recognised option/,
    );
  });

  it('rejects an override without a match pattern', () => {
    assert.throws(() => resolveConfig({ routeOverrides: [{ timeout: 1 }] }), /string or RegExp/);
  });
});
