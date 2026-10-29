import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { injectPreloadLinks } from '../../src/core/preload-links.js';

function documentOf(head = '', body = '') {
  return `<!doctype html><html><head><title>Page</title>${head}</head><body>${body}</body></html>`;
}

describe('injectPreloadLinks', () => {
  it('adds module preload hints for runtime scripts', () => {
    const html = injectPreloadLinks(documentOf('', '<script src="/assets/app.js"></script>'), {
      scripts: ['/assets/app.js', '/assets/chunk.js'],
    });
    assert.equal(html.includes('rel="modulepreload" href="/assets/app.js"'), false);
    assert.match(html, /rel="modulepreload" href="\/assets\/chunk\.js"/);
  });

  it('adds font preloads with the captured content type and crossorigin', () => {
    const html = injectPreloadLinks(documentOf(), {
      fonts: new Map([['/assets/font.woff2', 'font/woff2']]),
    });
    assert.match(html, /rel="preload"/);
    assert.match(html, /as="font"/);
    assert.match(html, /href="\/assets\/font\.woff2"/);
    assert.match(html, /type="font\/woff2"/);
    assert.match(html, /crossorigin=""/);
  });

  it('omits the type when the font content type is unknown', () => {
    const html = injectPreloadLinks(documentOf(), {
      fonts: new Map([['/assets/font.woff2', null]]),
    });
    assert.equal(html.includes('type='), false);
  });

  it('preloads the LCP image with high priority', () => {
    const html = injectPreloadLinks(documentOf(), { lcpImage: '/hero.png' });
    assert.match(html, /rel="preload" as="image" href="\/hero\.png" fetchpriority="high"/);
  });

  it('respects the base path', () => {
    const html = injectPreloadLinks(documentOf(), {
      scripts: ['/assets/app.js'],
      lcpImage: '/hero.png',
      base: '/app/',
    });
    assert.match(html, /href="\/app\/assets\/app\.js"/);
    assert.match(html, /href="\/app\/hero\.png"/);
  });

  it('does not duplicate a hint that is already in the document', () => {
    const html = injectPreloadLinks(
      documentOf('<link rel="preload" href="/hero.png" as="image">'),
      { lcpImage: '/hero.png' },
    );
    assert.equal(html.match(/href="\/hero\.png"/g).length, 1);
  });

  it('honours the ignore list by file name', () => {
    const html = injectPreloadLinks(documentOf(), {
      scripts: ['/assets/service-worker.js'],
      ignoreForPreload: ['service-worker.js'],
    });
    assert.equal(html.includes('modulepreload'), false);
  });

  it('does not preload scripts the caller says were removed', () => {
    const html = injectPreloadLinks(documentOf(), {
      scripts: ['/assets/app.js'],
      skipScripts: new Set(['/assets/app.js']),
    });
    assert.equal(html.includes('modulepreload'), false);
  });

  it('keeps the head intact when there is nothing to add', () => {
    const source = documentOf('<meta name="description" content="x">');
    assert.equal(injectPreloadLinks(source, {}), source);
  });
});
