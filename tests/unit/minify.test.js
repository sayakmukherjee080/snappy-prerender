import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { minifyCss, minifyHtml } from '../../src/core/minify.js';

const PAGE =
  '<!DOCTYPE html><html><head><title>t</title></head><body>\n  <h1>Hi</h1>\n  <p>there</p>\n</body></html>';

describe('minifyHtml', () => {
  it('collapses whitespace by default', async () => {
    const output = await minifyHtml(PAGE, true);
    assert.equal(output.includes('\n  '), false);
    assert.match(output, /<h1>Hi<\/h1>/);
  });

  it('keeps whitespace when the option disables it', async () => {
    const output = await minifyHtml(PAGE, { collapseWhitespace: false });
    assert.equal(output.includes('\n  '), true);
  });

  it('minifies inline styles when minifyCss is enabled', async () => {
    const page =
      '<!DOCTYPE html><html><head><style>.a {\n  color: red;\n}</style></head><body></body></html>';
    const output = await minifyHtml(page, true, true);
    assert.match(output, /\.a\{color:red\}/);
  });
});

describe('minifyCss', () => {
  it('removes whitespace and comments', () => {
    assert.equal(minifyCss('/* c */ .a {\n  color: red;\n}'), '.a{color:red}');
  });
});
