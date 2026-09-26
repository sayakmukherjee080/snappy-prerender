import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toAppPath, withinCacheLimit } from '../../src/core/resources.js';

describe('toAppPath', () => {
  it('returns the path with its query string', () => {
    assert.equal(toAppPath('http://127.0.0.1:1/assets/app.js', '/'), '/assets/app.js');
    assert.equal(toAppPath('http://127.0.0.1:1/api/items?page=2', '/'), '/api/items?page=2');
  });

  it('strips the configured base path', () => {
    assert.equal(toAppPath('http://127.0.0.1:1/app/assets/app.js', '/app/'), '/assets/app.js');
  });

  it('returns null for URLs outside the base or unparsable input', () => {
    assert.equal(toAppPath('http://127.0.0.1:1/other/x.js', '/app/'), null);
    assert.equal(toAppPath('not a url', '/'), null);
  });

  it('does not treat a sibling path as being under the base', () => {
    assert.equal(toAppPath('http://127.0.0.1:1/apple/x.js', '/app/'), null);
    assert.equal(toAppPath('http://127.0.0.1:1/app', '/app/'), '/');
  });
});

describe('withinCacheLimit', () => {
  it('measures the serialised body against the budget', () => {
    assert.equal(withinCacheLimit({ items: [1, 2, 3] }, 100), true);
    assert.equal(withinCacheLimit({ text: 'x'.repeat(200) }, 100), false);
    assert.equal(withinCacheLimit({}, 2), true);
  });
});
