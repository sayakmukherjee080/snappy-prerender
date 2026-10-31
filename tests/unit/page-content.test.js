import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBootMarkupPreserved } from '../../src/core/page-content.js';

describe('isBootMarkupPreserved', () => {
  it('reports unknown when the prerendered child was never seen', () => {
    assert.equal(
      isBootMarkupPreserved({ seen: false, childConnected: false, chainConnected: [] }),
      null,
    );
  });

  it('reports preservation when the first child survived without a chain', () => {
    assert.equal(
      isBootMarkupPreserved({ seen: true, childConnected: true, chainConnected: [] }),
      true,
    );
  });

  it('reports a re-render when any captured wrapper was replaced', () => {
    assert.equal(
      isBootMarkupPreserved({
        seen: true,
        childConnected: true,
        chainConnected: [true, false],
      }),
      false,
    );
  });

  it('reports preservation when the whole captured chain survived', () => {
    assert.equal(
      isBootMarkupPreserved({
        seen: true,
        childConnected: true,
        chainConnected: [true, true, true],
      }),
      true,
    );
  });
});
