import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normaliseHtml } from '../../src/core/normalize.js';

const PAGE = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="UTF-8">',
  '<style id="snappy-freeze">* { animation: none !important; }</style>',
  '<style>.button { color: red; }</style>',
  '<style>.button { color: red; }</style>',
  '<style>.unique { color: blue; }</style>',
  '</head>',
  '<body>',
  '<div id="root"><h1>Hello</h1><span data-prerender-remove>debug</span></div>',
  '<script type="module" src="/assets/app.js"></script>',
  '</body>',
  '</html>',
].join('');

describe('normaliseHtml', () => {
  it('removes the injected animation-freezing style', () => {
    const { html } = normaliseHtml(PAGE);
    assert.equal(html.includes('snappy-freeze'), false);
  });

  it('removes elements marked with data-prerender-remove', () => {
    const { html, stats } = normaliseHtml(PAGE);
    assert.equal(html.includes('data-prerender-remove'), false);
    assert.equal(html.includes('debug'), false);
    assert.equal(stats.removedElements, 2);
  });

  it('drops duplicate style tags but keeps unique ones', () => {
    const { html, stats } = normaliseHtml(PAGE);
    assert.equal(stats.dedupedStyles, 1);
    assert.equal(html.split('.button { color: red; }').length - 1, 1);
    assert.equal(html.includes('.unique { color: blue; }'), true);
  });

  it('preserves the doctype, app markup and module scripts', () => {
    const { html } = normaliseHtml(PAGE);
    assert.equal(html.startsWith('<!DOCTYPE html>'), true);
    assert.equal(html.includes('<h1>Hello</h1>'), true);
    assert.equal(html.includes('type="module"'), true);
    assert.equal(html.includes('/assets/app.js'), true);
  });

  it('removes marked elements inside template content', () => {
    const page =
      '<!DOCTYPE html><html><body><template><p data-prerender-remove>tmp</p></template></body></html>';
    const { html, stats } = normaliseHtml(page);
    assert.equal(html.includes('data-prerender-remove'), false);
    assert.equal(html.includes('tmp'), false);
    assert.equal(stats.removedElements, 1);
  });

  it('does not dedupe identical styles outside the head', () => {
    const page =
      '<!DOCTYPE html><html><head></head><body><style>.x{}</style><style>.x{}</style></body></html>';
    const { stats } = normaliseHtml(page);
    assert.equal(stats.dedupedStyles, 0);
  });
});

describe('normaliseHtml post-processing', () => {
  const PAGE =
    '<!DOCTYPE html><html><head><style>.a{}</style><link rel="stylesheet" href="/app.css"></head>' +
    '<body><script src="/app.js"></script><script>inline()</script>' +
    '<link rel="stylesheet" href="blob:http://127.0.0.1/1"><img src="/hero.png"></body></html>';

  it('removes every style tag when asked', () => {
    const { html } = normaliseHtml(PAGE, { removeStyleTags: true });
    assert.equal(html.includes('<style'), false);
    assert.equal(html.includes('/app.css'), true);
  });

  it('removes every script tag when asked', () => {
    const { html } = normaliseHtml(PAGE, { removeScriptTags: true });
    assert.equal(html.includes('<script'), false);
  });

  it('marks external scripts async without touching inline or deferred ones', () => {
    const page =
      '<!DOCTYPE html><html><head></head><body>' +
      '<script src="/app.js"></script><script src="/defer.js" defer></script><script>inline()</script>' +
      '</body></html>';
    const { html } = normaliseHtml(page, { asyncScriptTags: true });
    assert.match(html, /<script src="\/app\.js" async=""><\/script>/);
    assert.equal(html.includes('async="" defer'), false);
    assert.match(html, /<script>inline\(\)<\/script>/);
  });

  it('drops dead blob stylesheets and keeps real ones', () => {
    const { html } = normaliseHtml(PAGE, { removeBlobs: true });
    assert.equal(html.includes('blob:'), false);
    assert.equal(html.includes('/app.css'), true);
  });

  it('injects preconnect hints and skips duplicates', () => {
    const { html, stats } = normaliseHtml(PAGE, {
      preconnectOrigins: ['https://api.example.com', 'https://api.example.com'],
    });
    assert.equal(html.split('https://api.example.com').length - 1, 1);
    assert.match(html, /<link rel="preconnect" href="https:\/\/api\.example\.com">/);
    assert.equal(stats.hints, 1);
  });

  it('does not repeat a preconnect that the page already declares', () => {
    const page =
      '<!DOCTYPE html><html><head><link rel="preconnect" href="https://api.example.com"></head><body></body></html>';
    const { html, stats } = normaliseHtml(page, { preconnectOrigins: ['https://api.example.com'] });
    assert.equal(html.split('api.example.com').length - 1, 1);
    assert.equal(stats.hints, 0);
  });

  it('injects image preload hints', () => {
    const { html, stats } = normaliseHtml(PAGE, { preloadImages: ['/app/hero.png'] });
    assert.match(html, /<link rel="preload" as="image" href="\/app\/hero\.png">/);
    assert.equal(stats.hints, 1);
  });

  it('collects build server origins from metadata tags only', () => {
    const page = [
      '<!DOCTYPE html><html><head>',
      '<meta property="og:url" content="http://127.0.0.1:5500/a">',
      '<link rel="canonical" href="http://localhost:5500/a">',
      '<script>window.snapStore={"u":"http://localhost:9999/api"};</script>',
      '</head><body></body></html>',
    ].join('');
    const { stats } = normaliseHtml(page);
    assert.deepEqual(stats.metadataOrigins, ['http://127.0.0.1:5500', 'http://localhost:5500']);
  });

  it('reports nothing for metadata that points at a public site', () => {
    const page =
      '<!DOCTYPE html><html><head><link rel="canonical" href="https://pps.example/a"></head><body></body></html>';
    assert.deepEqual(normaliseHtml(page).stats.metadataOrigins, []);
  });

  it('counts title elements so duplicate titles can be reported', () => {
    const page =
      '<!DOCTYPE html><html><head><title>One</title><title>Two</title></head><body></body></html>';
    assert.equal(normaliseHtml(page).stats.titleElements, 2);
    assert.equal(normaliseHtml(PAGE).stats.titleElements, 0);
  });

  it('keeps the persisted metadata element even when every other script is removed', () => {
    const page = [
      '<!DOCTYPE html><html><head>',
      '<script type="application/json" data-snappy-meta>{"siteUrl":"https://pps.example"}</script>',
      '</head><body><script src="/app.js"></script></body></html>',
    ].join('');
    const { html, stats } = normaliseHtml(page, { removeScriptTags: true });
    assert.equal(html.includes('data-snappy-meta'), true);
    assert.equal(html.includes('https://pps.example'), true);
    assert.equal(html.includes('/app.js'), false);
    assert.equal(stats.removedElements, 1);
  });
});
