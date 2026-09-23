import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldPrerender } from '../../src/vite-plugin.js';

const clientConfig = { build: { ssr: false, lib: false, write: true } };

describe('shouldPrerender', () => {
  it('prerenders a normal client build, with or without an environment name', () => {
    assert.equal(shouldPrerender(clientConfig, 'client'), true);
    assert.equal(shouldPrerender(clientConfig, undefined), true);
  });

  it('skips builds that have no HTML entry to prerender', () => {
    assert.equal(shouldPrerender(null, 'client'), false);
    assert.equal(shouldPrerender({ build: { ...clientConfig.build, ssr: true } }, 'client'), false);
    assert.equal(shouldPrerender({ build: { ...clientConfig.build, lib: {} } }, 'client'), false);
    assert.equal(
      shouldPrerender({ build: { ...clientConfig.build, write: false } }, 'client'),
      false,
    );
  });

  it('skips every environment except the client one', () => {
    assert.equal(shouldPrerender(clientConfig, 'ssr'), false);
    assert.equal(shouldPrerender(clientConfig, 'custom'), false);
  });
});
