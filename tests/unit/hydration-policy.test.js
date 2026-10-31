import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isHydrationAllowed, resolveHydrationPolicy } from '../../src/core/hydration-policy.js';

describe('resolveHydrationPolicy', () => {
  it('defaults to strict', () => {
    assert.equal(resolveHydrationPolicy({}, '/'), 'strict');
  });

  it('matches global allow and skip lists', () => {
    const config = {
      hydration: { allowRerender: ['/live/*'], skip: ['/admin/*'] },
    };
    assert.equal(resolveHydrationPolicy(config, '/live/status'), 'allow-rerender');
    assert.equal(resolveHydrationPolicy(config, '/admin/users'), 'skip');
    assert.equal(resolveHydrationPolicy(config, '/'), 'strict');
  });

  it('lets skip win when both global lists match', () => {
    const config = {
      hydration: { allowRerender: ['/live/*'], skip: ['/live/private'] },
    };
    assert.equal(resolveHydrationPolicy(config, '/live/private'), 'skip');
  });

  it('lets a route override win over the global policy', () => {
    const config = {
      hydration: { allowRerender: ['/live/*'] },
      routeOverrides: [
        { match: '/live/status', hydration: 'skip' },
        { match: '/live/status', hydration: 'strict' },
      ],
    };
    assert.equal(resolveHydrationPolicy(config, '/live/status'), 'strict');
  });
});

describe('isHydrationAllowed', () => {
  it('only allows a re-render or hydration error under allow-rerender', () => {
    assert.equal(isHydrationAllowed('strict', { mode: 're-rendered', hydrationErrors: [] }), false);
    assert.equal(
      isHydrationAllowed('allow-rerender', { mode: 're-rendered', hydrationErrors: [] }),
      true,
    );
    assert.equal(
      isHydrationAllowed('allow-rerender', { mode: 'hydrated', hydrationErrors: ['err'] }),
      true,
    );
    assert.equal(
      isHydrationAllowed('allow-rerender', { mode: 'hydrated', hydrationErrors: [] }),
      false,
    );
  });
});
