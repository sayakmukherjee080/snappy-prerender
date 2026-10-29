import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareContainers } from '../../src/core/hydration-diff.js';

function documentOf(body) {
  return `<!doctype html><html><body>${body}</body></html>`;
}

describe('compareContainers', () => {
  it('returns null for identical markup', () => {
    const html = documentOf('<div id="root"><h1>Hello</h1></div>');
    assert.equal(compareContainers(html, html), null);
  });

  it('locates a changed text node', () => {
    const expected = documentOf('<div id="root"><h1>Hello</h1></div>');
    const actual = '<div id="root"><h1>Goodbye</h1></div>';
    assert.deepEqual(compareContainers(expected, actual), {
      path: 'body>div[0]>h1',
      kind: 'text',
      expected: 'Hello',
      actual: 'Goodbye',
    });
  });

  it('locates a changed attribute', () => {
    const expected = documentOf('<div id="root"><a href="/a">A</a></div>');
    const actual = '<div id="root"><a href="/b">A</a></div>';
    const difference = compareContainers(expected, actual);
    assert.equal(difference.kind, 'attribute');
    assert.equal(difference.name, 'href');
    assert.equal(difference.expected, '/a');
    assert.equal(difference.actual, '/b');
  });

  it('locates a missing child on the parent path', () => {
    const expected = documentOf('<div id="root"><h1>Hello</h1><p>Copy</p></div>');
    const actual = '<div id="root"><h1>Hello</h1></div>';
    const difference = compareContainers(expected, actual);
    assert.equal(difference.kind, 'missing');
    assert.equal(difference.expected, 'p');
    assert.equal(difference.path, 'body>div');
  });

  it('locates an extra child', () => {
    const expected = documentOf('<div id="root"><h1>Hello</h1></div>');
    const actual = '<div id="root"><h1>Hello</h1><p>Extra</p></div>';
    const difference = compareContainers(expected, actual);
    assert.equal(difference.kind, 'extra');
    assert.equal(difference.actual, 'p');
  });

  it('locates a different tag', () => {
    const expected = documentOf('<div id="root"><h1>Hello</h1></div>');
    const actual = '<div id="root"><h2>Hello</h2></div>';
    const difference = compareContainers(expected, actual);
    assert.equal(difference.kind, 'tag');
    assert.equal(difference.expected, 'h1');
    assert.equal(difference.actual, 'h2');
  });
});
