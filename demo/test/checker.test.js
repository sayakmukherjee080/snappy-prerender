import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CheckError,
  isBlockedAddress,
  isSafePreviewImage,
  normalizeUrl,
  parseMetadata,
} from '../checker.mjs';

/**
 * Asserts that a URL is rejected with a stable checker code.
 * @param {string} value
 * @param {string} code
 */
function assertRejected(value, code) {
  assert.throws(
    () => normalizeUrl(value),
    (error) => error instanceof CheckError && error.code === code,
  );
}

describe('normalizeUrl', () => {
  it('adds https to a bare hostname', () => {
    assert.equal(normalizeUrl('example.com').href, 'https://example.com/');
  });

  it('keeps an http URL and removes its fragment', () => {
    assert.equal(
      normalizeUrl('http://example.com/docs?page=1#section').href,
      'http://example.com/docs?page=1',
    );
  });

  it('rejects empty input', () => {
    assertRejected('', 'URL_REQUIRED');
  });

  it('rejects non-web protocols', () => {
    assertRejected('ftp://example.com', 'INVALID_PROTOCOL');
    assertRejected('javascript:alert(1)', 'INVALID_PROTOCOL');
  });

  it('rejects credentials', () => {
    assertRejected('https://user:pass@example.com', 'CREDENTIALS_NOT_ALLOWED');
  });

  it('rejects non-web ports', () => {
    assertRejected('http://example.com:8080', 'PORT_NOT_ALLOWED');
  });

  it('rejects local and private hosts', () => {
    assertRejected('http://localhost', 'PRIVATE_ADDRESS');
    assertRejected('http://127.0.0.1', 'PRIVATE_ADDRESS');
    assertRejected('http://10.0.0.8', 'PRIVATE_ADDRESS');
    assertRejected('http://169.254.169.254', 'PRIVATE_ADDRESS');
    assertRejected('http://[::1]', 'PRIVATE_ADDRESS');
    assertRejected('http://[fd00::1]', 'PRIVATE_ADDRESS');
  });

  it('rejects an oversized URL', () => {
    assertRejected(`https://example.com/${'a'.repeat(2048)}`, 'URL_TOO_LONG');
  });

  it('accepts a public IP address', () => {
    assert.equal(normalizeUrl('https://8.8.8.8').href, 'https://8.8.8.8/');
  });
});

describe('isBlockedAddress', () => {
  it('blocks reserved IPv4 and IPv6 ranges', () => {
    for (const address of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '::',
      '::1',
      '::127.0.0.1',
      '::ffff:127.0.0.1',
      '::ffff:0:127.0.0.1',
      'fc00::1',
      'fe80::1',
      '2001:db8::1',
      '64:ff9b::7f00:1',
      '2002:7f00:1::',
      '2001:0:1::1',
    ]) {
      assert.equal(isBlockedAddress(address), true, address);
    }
  });

  it('allows public addresses', () => {
    assert.equal(isBlockedAddress('8.8.8.8'), false);
    assert.equal(isBlockedAddress('2001:4860:4860::8888'), false);
  });
});

describe('isSafePreviewImage', () => {
  it('allows same-origin and public image hosts', async () => {
    assert.equal(
      await isSafePreviewImage('https://example.com/og.png', new URL('https://example.com/'), 5000),
      true,
    );
    assert.equal(
      await isSafePreviewImage('https://8.8.8.8/og.png', new URL('https://example.com/'), 5000),
      true,
    );
  });

  it('blocks private and non-web image hosts', async () => {
    assert.equal(
      await isSafePreviewImage('http://127.0.0.1/og.png', new URL('https://example.com/'), 5000),
      false,
    );
    assert.equal(
      await isSafePreviewImage('http://10.0.0.1/og.png', new URL('https://example.com/'), 5000),
      false,
    );
    assert.equal(
      await isSafePreviewImage('javascript:alert(1)', new URL('https://example.com/'), 5000),
      false,
    );
  });
});

describe('parseMetadata', () => {
  it('extracts title, description, canonical, Open Graph and Twitter fields', () => {
    const html = `<!doctype html><html lang="en"><head>
      <title>Hello &amp; welcome</title>
      <meta name="description" content="A &quot;test&quot; page">
      <meta name="robots" content="noindex,follow">
      <meta property="og:title" content="Open Graph title">
      <meta property="og:description" content="Open Graph description">
      <meta property="og:image" content="/image.png">
      <meta property="og:type" content="article">
      <meta property="og:site_name" content="Example">
      <meta name="twitter:card" content="summary_large_image">
      <link rel="canonical" href="/canonical">
    </head><body><h1>One</h1><h1>Two</h1><p>Body text</p></body></html>`;
    const page = parseMetadata(html, 'https://example.com/blog/');

    assert.equal(page.title, 'Hello & welcome');
    assert.equal(page.description, 'A "test" page');
    assert.equal(page.canonical, 'https://example.com/canonical');
    assert.equal(page.robots, 'noindex,follow');
    assert.equal(page.lang, 'en');
    assert.equal(page.h1Count, 2);
    assert.ok(page.textLength > 0);
    assert.equal(page.og.title, 'Open Graph title');
    assert.equal(page.og.image, 'https://example.com/image.png');
    assert.equal(page.og.type, 'article');
    assert.equal(page.og.siteName, 'Example');
    assert.equal(page.twitter.card, 'summary_large_image');
  });

  it('returns nulls for missing metadata', () => {
    const page = parseMetadata(
      '<html><body><p>Nothing here</p></body></html>',
      'https://example.com',
    );
    assert.equal(page.title, null);
    assert.equal(page.description, null);
    assert.equal(page.canonical, null);
    assert.equal(page.og.image, null);
    assert.equal(page.twitter.card, null);
  });

  it('clips oversized metadata fields', () => {
    const page = parseMetadata(
      `<html><head><title>${'a'.repeat(5000)}</title><meta name="description" content="${'b'.repeat(5000)}"></head></html>`,
      'https://example.com',
    );
    assert.ok(page.title.length <= 300);
    assert.ok(page.description.length <= 1000);
  });
});
