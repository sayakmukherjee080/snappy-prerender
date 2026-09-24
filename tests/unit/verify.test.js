import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyBoot, isHydrationError } from '../../src/core/verify.js';

describe('isHydrationError', () => {
  it('detects React 18 and 19 hydration messages', () => {
    assert.equal(isHydrationError('Hydration failed because the initial UI does not match'), true);
    assert.equal(
      isHydrationError('Text content does not match server-rendered HTML. See more info here'),
      true,
    );
    assert.equal(
      isHydrationError('There was an error while hydrating this Suspense boundary'),
      true,
    );
  });

  it('detects minified production error references', () => {
    assert.equal(
      isHydrationError('Minified React error #418; visit https://react.dev/errors/418'),
      true,
    );
    assert.equal(isHydrationError('Minified React error #423'), true);
    assert.equal(isHydrationError('Minified React error #425?args[]=x'), true);
  });

  it('ignores unrelated console errors', () => {
    assert.equal(isHydrationError('Failed to load resource: 404'), false);
    assert.equal(isHydrationError('Minified React error #130'), false);
  });

  it('ignores non-hydration React 4xx codes so builds are not failed by mistake', () => {
    assert.equal(
      isHydrationError('Minified React error #400; visit https://react.dev/errors/400'),
      false,
    );
    assert.equal(isHydrationError('Minified React error #408'), false);
  });

  it('ignores generic mismatch wording from non-React sources', () => {
    assert.equal(isHydrationError('Origin does not match the allowed list'), false);
    assert.equal(isHydrationError('CSP header does not match policy'), false);
  });
});

describe('classifyBoot', () => {
  it('reports hydrated when the app keeps the prerendered markup', () => {
    assert.equal(classifyBoot({ markupPreserved: true, frameworkMounted: true }), 'hydrated');
  });

  it('reports re-rendered when the markup is discarded', () => {
    assert.equal(classifyBoot({ markupPreserved: false, frameworkMounted: true }), 're-rendered');
  });

  it('reports undetected when no React root attached to the container', () => {
    assert.equal(classifyBoot({ markupPreserved: true, frameworkMounted: false }), 'undetected');
  });

  it('reports unknown when the prerendered child was never seen', () => {
    assert.equal(classifyBoot({ markupPreserved: null, frameworkMounted: true }), 'unknown');
  });
});
