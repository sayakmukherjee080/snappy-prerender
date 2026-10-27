import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasImportRule, rewriteCssUrls } from '../../src/core/css-url.js';

const origin = 'http://127.0.0.1:4000';

describe('rewriteCssUrls', () => {
  it('rebases relative font and image URLs against the stylesheet', () => {
    const css = '.a { background: url(../img/a.png); src: url("fonts/a.woff2") }';
    const result = rewriteCssUrls(css, 'http://127.0.0.1:4000/assets/app.css', origin);
    assert.match(result, /url\(\/img\/a\.png\)/);
    assert.match(result, /url\("\/assets\/fonts\/a\.woff2"\)/);
  });

  it('keeps absolute, protocol-relative, data and fragment URLs unchanged', () => {
    const css = [
      '.a { background: url(https://cdn.example/a.png) }',
      '.b { background: url(//cdn.example/b.png) }',
      '.c { background: url(data:image/png;base64,AAAA) }',
      '.d { background: url(#gradient) }',
    ].join('\n');
    assert.equal(rewriteCssUrls(css, `${origin}/assets/app.css`, origin), css);
  });

  it('leaves external URLs absolute and preserves query and hash', () => {
    const result = rewriteCssUrls(
      '.a { background: url(../img/a.png?v=1#x) }',
      'https://cdn.example/assets/app.css',
      origin,
    );
    assert.equal(result, '.a { background: url(https://cdn.example/img/a.png?v=1#x) }');
  });

  it('recognises @import rules so the caller can leave that sheet as a link', () => {
    assert.equal(hasImportRule('@import url("base.css"); .a{}'), true);
    assert.equal(hasImportRule('.a{background:url(a.png)}'), false);
  });
});
