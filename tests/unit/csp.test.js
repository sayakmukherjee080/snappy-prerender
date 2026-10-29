import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { applyCspHashes } from '../../src/core/csp.js';

function hash(text) {
  return `sha256-${createHash('sha256').update(text).digest('base64')}`;
}

function documentOf(body) {
  return `<!doctype html><html><head><title>Page</title></head><body>${body}</body></html>`;
}

describe('applyCspHashes', () => {
  it('hashes executable inline scripts and styles', () => {
    const result = applyCspHashes(documentOf('<script>run()</script><style>.a{color:red}</style>'));
    const policy = result.html.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/,
    );
    assert.ok(policy);
    assert.equal(result.hashedScripts, 1);
    assert.equal(result.hashedStyles, 1);
    assert.equal(result.existingPolicy, false);
    assert.equal(policy[1].includes(`script-src 'self' '${hash('run()')}'`), true);
    assert.equal(policy[1].includes(`style-src 'self' '${hash('.a{color:red}')}'`), true);
    assert.equal(
      result.html.indexOf('<meta http-equiv="Content-Security-Policy"'),
      result.html.indexOf('<head>') + 6,
    );
  });

  it('skips JSON-LD, data blocks and external scripts', () => {
    const result = applyCspHashes(
      documentOf(
        [
          '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
          '<script type="application/json">{"state":true}</script>',
          '<script type="importmap">{"imports":{}}</script>',
          '<script src="/app.js"></script>',
        ].join(''),
      ),
    );
    const policy = result.html.match(/content="([^"]+)"/)[1];
    assert.equal(result.hashedScripts, 0);
    assert.equal(policy.includes('sha256-'), false);
  });

  it('deduplicates identical text and keeps document order', () => {
    const result = applyCspHashes(documentOf('<script>a()</script><script>a()</script>'));
    const policy = result.html.match(/content="([^"]+)"/)[1];
    assert.equal(policy.match(/sha256-/g).length, 1);
  });

  it('hashes the minified text it is given, not the source', () => {
    const result = applyCspHashes(documentOf('<script>const a = 1;</script>'));
    assert.equal(result.html.includes(hash('const a = 1;')), true);
    assert.equal(result.html.includes(hash('const a = 1; ')), false);
  });

  it('leaves a document with an existing policy untouched', () => {
    const html = documentOf('<script>run()</script>').replace(
      '<head>',
      '<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'">',
    );
    const result = applyCspHashes(html);
    assert.equal(result.existingPolicy, true);
    assert.equal(result.html, html);
    assert.equal((result.html.match(/Content-Security-Policy/g) ?? []).length, 1);
  });

  it('replaces the policy it wrote on an earlier run', () => {
    const first = applyCspHashes(documentOf('<script>first()</script>'));
    assert.match(first.html, /data-snappy-csp/);
    const second = applyCspHashes(first.html.replace('first()', 'second()'));
    assert.equal(second.existingPolicy, false);
    assert.equal(second.hashedScripts, 1);
    assert.equal((second.html.match(/Content-Security-Policy/g) ?? []).length, 1);
    assert.equal(second.html.includes(hash('second()')), true);
    assert.equal(second.html.includes(hash('first()')), false);
  });
});
