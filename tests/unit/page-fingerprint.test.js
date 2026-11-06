import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from 'parse5';
import { fingerprintDocument } from '../../src/core/page-fingerprint.js';

const page = (body, head = '') =>
  `<html><head><title>Home</title><meta name="description" content="Demo">${head}</head><body>${body}</body></html>`;

describe('fingerprintDocument', () => {
  it('ignores whitespace differences in visible text', () => {
    const left = fingerprintDocument(parse(page('<main><h1>Hello</h1><p>One two</p></main>')));
    const right = fingerprintDocument(
      parse(page('<main><h1>Hello</h1>\n  <p>One\n two</p></main>')),
    );
    assert.equal(left.contentHash, right.contentHash);
    assert.equal(left.textLength, right.textLength);
  });

  it('ignores script and style changes', () => {
    const left = fingerprintDocument(
      parse(page('<main><h1>Hello</h1></main><script>window.a = 1</script>')),
    );
    const right = fingerprintDocument(
      parse(
        page(
          '<main><h1>Hello</h1></main><script>window.a = 2</script><style>h1{color:red}</style>',
        ),
      ),
    );
    assert.equal(left.contentHash, right.contentHash);
  });

  it('changes when visible text, metadata, links or images change', () => {
    const base = fingerprintDocument(
      parse(page('<main><h1>Hello</h1><a href="/a">A</a><img src="/a.png" alt="A"></main>')),
    );
    const text = fingerprintDocument(parse(page('<main><h1>Changed</h1></main>')));
    const meta = fingerprintDocument(
      parse(page('<main><h1>Hello</h1></main>', '<meta property="og:title" content="Changed">')),
    );
    const link = fingerprintDocument(parse(page('<main><h1>Hello</h1><a href="/b">A</a></main>')));
    const image = fingerprintDocument(
      parse(page('<main><h1>Hello</h1><img src="/b.png" alt="A"></main>')),
    );
    for (const other of [text, meta, link, image]) {
      assert.notEqual(base.contentHash, other.contentHash);
    }
  });

  it('includes JSON-LD and excludes ordinary scripts', () => {
    const withData = fingerprintDocument(
      parse(
        page(
          '<main><h1>Hello</h1></main><script type="application/ld+json">{"@type":"WebPage"}</script>',
        ),
      ),
    );
    const changedData = fingerprintDocument(
      parse(
        page(
          '<main><h1>Hello</h1></main><script type="application/ld+json">{"@type":"Article"}</script>',
        ),
      ),
    );
    assert.notEqual(withData.contentHash, changedData.contentHash);
    assert.deepEqual(withData.fingerprint.jsonLd, ['{"@type":"WebPage"}']);
  });

  it('is deterministic across repeated calls', () => {
    const html = parse(page('<main><h1>Hello</h1><a href="/a">A</a></main>'));
    assert.equal(fingerprintDocument(html).contentHash, fingerprintDocument(html).contentHash);
  });
});
