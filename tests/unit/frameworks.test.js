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

  it('detects Svelte 5 hydration anchors', () => {
    const container = { childNodes: [{ nodeType: 8, data: '[' }, { nodeType: 1 }] };
    assert.deepEqual(detectFramework(container), { name: 'svelte', mounted: true });
    const elseBlock = { childNodes: [{ nodeType: 8, data: '[!' }] };
    assert.deepEqual(detectFramework(elseBlock), { name: 'svelte', mounted: true });
    assert.deepEqual(detectFramework({ childNodes: [{ nodeType: 8, data: 'plain comment' }] }), {
      name: null,
      mounted: false,
    });
  });

  it('does not auto-detect Svelte from the page global alone', () => {
    const container = {
      ownerDocument: { defaultView: { __svelte: { v: new Set(['5.0.0']) } } },
    };
    assert.deepEqual(detectFramework(container), { name: null, mounted: false });
    assert.deepEqual(detectFramework(container, 'svelte'), { name: 'svelte', mounted: true });
  });

  it('detects Angular from the root attribute or descendant', () => {
    const angular = { hasAttribute: (name) => name === 'ng-version' };
    assert.deepEqual(detectFramework(angular), { name: 'angular', mounted: true });
    const wrapper = { querySelector: (selector) => (selector === '[ng-version]' ? {} : null) };
    assert.deepEqual(detectFramework(wrapper), { name: 'angular', mounted: true });
  });

  it('detects Ember from the application body or an ember view', () => {
    const body = { classList: { contains: (name) => name === 'ember-application' } };
    assert.deepEqual(detectFramework(body), { name: 'ember', mounted: true });
    const view = {
      classList: { contains: () => false },
      querySelector: (selector) => (selector === '.ember-view' ? {} : null),
    };
    assert.deepEqual(detectFramework(view), { name: 'ember', mounted: true });
  });

  it('detects Lit from its part on the container or first child', () => {
    assert.deepEqual(detectFramework({ _$litPart$: {} }), { name: 'lit', mounted: true });
    assert.deepEqual(detectFramework({ firstElementChild: { _$litPart$: {} } }), {
      name: 'lit',
      mounted: true,
    });
  });

  it('requires Solid to be explicit', () => {
    assert.deepEqual(detectFramework({}), { name: null, mounted: false });
    assert.deepEqual(detectFramework({}, 'solid'), { name: 'solid', mounted: true });
  });

  it('does not mistake plain keys for a framework', () => {
    assert.deepEqual(detectFramework({ __custom: true, _children: undefined }), {
      name: null,
      mounted: false,
    });
  });

  it('treats an explicitly requested framework as authoritative', () => {
    assert.deepEqual(detectFramework({ __vue_app__: {} }, 'react'), {
      name: 'react',
      mounted: true,
    });
    assert.deepEqual(detectFramework({ __vue_app__: {} }, 'vue'), {
      name: 'vue',
      mounted: true,
    });
    assert.deepEqual(detectFramework({}, 'react'), { name: 'react', mounted: true });
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

  it('trusts an explicit framework even without its marker', () => {
    assert.deepEqual(frameworkFromMarkers({}, 'react'), { name: 'react', mounted: true });
    assert.deepEqual(frameworkFromMarkers({ svelte: true }, 'vue'), {
      name: 'vue',
      mounted: true,
    });
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

  it('recognises Angular hydration codes', () => {
    assert.equal(isHydrationError('NG0500: Angular hydration failed', 'angular'), true);
    assert.equal(isHydrationError('Angular: hydration mismatch in a component', 'angular'), true);
    assert.equal(isHydrationError('NG0500: Angular component mismatch', 'react'), false);
  });

  it('recognises Ember, Lit and Solid hydration messages', () => {
    assert.equal(isHydrationError('Ember hydration failed', 'ember'), true);
    assert.equal(isHydrationError('lit-html part mismatch', 'lit'), true);
    assert.equal(isHydrationError('Hydration mismatch in Solid', 'solid'), true);
    assert.equal(isHydrationError('hydration_mismatch', 'lit'), false);
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
