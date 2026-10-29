import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectFramework,
  frameworkFromMarkers,
  isHydrationError,
} from '../../src/core/frameworks.js';

describe('detectFramework', () => {
  it('detects React from its container keys', () => {
    const container = { __reactContainer$abc: {} };
    assert.deepEqual(detectFramework(container), { name: 'react', mounted: true });
  });

  it('detects Vue 2 and Vue 3 markers', () => {
    assert.deepEqual(detectFramework({ __vue_app__: {} }), { name: 'vue', mounted: true });
    assert.deepEqual(detectFramework({ _vnode: {} }), { name: 'vue', mounted: true });
    assert.deepEqual(detectFramework({ __vue__: {} }), { name: 'vue', mounted: true });
  });

  it('detects Preact on the container or its first child', () => {
    assert.deepEqual(detectFramework({ __k: {} }), { name: 'preact', mounted: true });
    assert.deepEqual(detectFramework({ firstElementChild: { _children: [] } }), {
      name: 'preact',
      mounted: true,
    });
  });

  it('detects Svelte from the container or a descendant marker', () => {
    assert.deepEqual(detectFramework({ __svelte_meta: {} }), { name: 'svelte', mounted: true });
    const container = { querySelector: (selector) => (selector === '[data-svelte-h]' ? {} : null) };
    assert.deepEqual(detectFramework(container), { name: 'svelte', mounted: true });
  });

  it('does not mistake plain keys for a framework', () => {
    assert.deepEqual(detectFramework({ __custom: true, _children: undefined }), {
      name: null,
      mounted: false,
    });
  });

  it('limits detection to an explicitly requested framework', () => {
    assert.deepEqual(detectFramework({ __vue_app__: {} }, 'react'), {
      name: 'react',
      mounted: false,
    });
    assert.deepEqual(detectFramework({ __vue_app__: {} }, 'vue'), {
      name: 'vue',
      mounted: true,
    });
  });
});

describe('frameworkFromMarkers', () => {
  it('selects the first marker in the stable order for auto', () => {
    assert.deepEqual(frameworkFromMarkers({ svelte: true, react: true }), {
      name: 'react',
      mounted: true,
    });
  });

  it('reports no framework when nothing matches', () => {
    assert.deepEqual(frameworkFromMarkers({}), { name: null, mounted: false });
  });
});

describe('isHydrationError framework patterns', () => {
  it('recognises Vue mismatch messages', () => {
    assert.equal(isHydrationError('Hydration node mismatch', 'vue'), true);
    assert.equal(isHydrationError('Hydration children mismatch', 'vue'), true);
  });

  it('recognises Svelte mismatch messages', () => {
    assert.equal(isHydrationError('hydration_mismatch', 'svelte'), true);
    assert.equal(isHydrationError('Hydration failed because of a mismatch', 'svelte'), true);
  });

  it('keeps React patterns for React and Preact', () => {
    assert.equal(
      isHydrationError('Text content does not match server-rendered HTML', 'react'),
      true,
    );
    assert.equal(isHydrationError('Did not expect server HTML to contain a div', 'preact'), true);
  });

  it('does not apply another framework pattern to an explicit framework', () => {
    assert.equal(isHydrationError('Hydration node mismatch', 'svelte'), false);
    assert.equal(isHydrationError('Text content did not match', 'vue'), false);
    assert.equal(isHydrationError('Minified React error #418', 'svelte'), false);
    assert.equal(isHydrationError('Minified React error #418', 'react'), true);
  });
});
