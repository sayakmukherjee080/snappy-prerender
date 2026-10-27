import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clearHead, setHead } from '../../src/head/index.js';

/**
 * The imperative head API runs without a document in Node. These calls only need to
 * reach the manager, which is a no-op outside a browser, so a missing default accessor
 * shows up here as a ReferenceError instead of surfacing in a consumer's browser.
 */
describe('imperative head API', () => {
  it('registers metadata without a document', () => {
    assert.doesNotThrow(() => setHead('unit-test', { title: 'Unit test' }));
  });

  it('removes metadata without a document', () => {
    assert.doesNotThrow(() => clearHead('unit-test'));
  });
});
