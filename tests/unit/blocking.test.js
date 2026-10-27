import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isHostAllowed } from '../../src/core/blocking.js';

describe('isHostAllowed', () => {
  it('matches a hostname regardless of port', () => {
    assert.equal(isHostAllowed('api.example.com', '443', ['api.example.com']), true);
    assert.equal(isHostAllowed('other.example.com', '443', ['api.example.com']), false);
  });

  it('matches an explicit port when one is written', () => {
    assert.equal(isHostAllowed('api.example.com', '8080', ['api.example.com:8080']), true);
    assert.equal(isHostAllowed('api.example.com', '9090', ['api.example.com:8080']), false);
  });

  it('matches wildcard and leading-dot suffixes without the apex', () => {
    assert.equal(isHostAllowed('cdn.example.com', '', ['*.example.com']), true);
    assert.equal(isHostAllowed('example.com', '', ['*.example.com']), false);
    assert.equal(isHostAllowed('cdn.example.com', '', ['.example.com']), true);
  });

  it('matches a full URL entry and ignores malformed entries', () => {
    assert.equal(isHostAllowed('api.example.com', '', ['https://api.example.com']), true);
    assert.equal(isHostAllowed('api.example.com', '', ['not a url']), false);
  });
});
