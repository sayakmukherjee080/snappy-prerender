import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withTrailingSlash } from '../../src/core/url-policy.js';

describe('withTrailingSlash', () => {
  it('applies the always convention before the query and fragment', () => {
    assert.equal(
      withTrailingSlash('https://example.com/docs?mode=api#install', 'always'),
      'https://example.com/docs/?mode=api#install',
    );
    assert.equal(
      withTrailingSlash('https://example.com/docs#install', 'always'),
      'https://example.com/docs/#install',
    );
  });

  it('applies the never convention before the query and fragment', () => {
    assert.equal(
      withTrailingSlash('https://example.com/docs/?mode=api#install', 'never'),
      'https://example.com/docs?mode=api#install',
    );
    assert.equal(
      withTrailingSlash('https://example.com/docs/#install', 'never'),
      'https://example.com/docs#install',
    );
  });

  it('keeps the root slash under the never convention', () => {
    assert.equal(withTrailingSlash('https://example.com', 'never'), 'https://example.com/');
    assert.equal(
      withTrailingSlash('https://example.com/?x=1', 'never'),
      'https://example.com/?x=1',
    );
  });

  it('leaves preserve and asset URLs alone', () => {
    assert.equal(
      withTrailingSlash('https://example.com/docs#install', 'preserve'),
      'https://example.com/docs#install',
    );
  });
});
