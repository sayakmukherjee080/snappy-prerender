import { parse } from 'parse5';

const CONTAINER_IDS = new Set(['root', 'app', '__next']);
const STABLE_ATTRIBUTES = ['id', 'class', 'href', 'src', 'type', 'role', 'name'];
const MAX_NODES = 5000;
const MAX_DEPTH = 20;

/**
 * Finds the first meaningful difference between the prerendered document and the live
 * post-boot container. Bounded so a large app cannot turn verification into a memory
 * problem.
 */
export function compareContainers(expectedHtml, liveHtml) {
  const expected = containerOf(parse(expectedHtml));
  const actual = containerOf(parse(liveHtml));
  if (!expected || !actual) return null;
  const state = { visited: 0 };
  return diffNode(expected, actual, 'body', 0, state);
}

// Finds the app container in a parsed document, falling back to the body's first child.
function containerOf(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  const body = (html?.childNodes ?? []).find((node) => node.tagName === 'body');
  if (!body) return null;
  const container = (body.childNodes ?? []).find(
    (node) => node.tagName && CONTAINER_IDS.has(attribute(node, 'id')),
  );
  return container ?? (body.childNodes ?? []).find((node) => node.tagName) ?? null;
}

// Compares one node pair and descends into the first differing child.
function diffNode(expected, actual, path, depth, state) {
  if (state.visited > MAX_NODES || depth > MAX_DEPTH) return null;
  state.visited += 1;
  const here = `${path}>${expected.tagName ?? expected.nodeName}`;
  if (!actual || expected.tagName !== actual.tagName) {
    return {
      path,
      kind: 'tag',
      expected: expected.tagName ?? expected.nodeName,
      actual: actual?.tagName ?? actual?.nodeName ?? null,
    };
  }
  for (const name of STABLE_ATTRIBUTES) {
    const left = attribute(expected, name);
    const right = attribute(actual, name);
    if (left !== right)
      return { path: here, kind: 'attribute', name, expected: left, actual: right };
  }
  const expectedChildren = elementChildren(expected);
  const actualChildren = elementChildren(actual);
  for (let index = 0; index < expectedChildren.length; index += 1) {
    const child = expectedChildren[index];
    const other = actualChildren[index];
    if (!other) {
      return {
        path: here,
        kind: 'missing',
        expected: child.tagName ?? child.nodeName,
        actual: null,
      };
    }
    const difference = diffNode(child, other, `${here}[${index}]`, depth + 1, state);
    if (difference) return difference;
  }
  if (actualChildren.length > expectedChildren.length) {
    const extra = actualChildren[expectedChildren.length];
    return { path: here, kind: 'extra', expected: null, actual: extra.tagName ?? extra.nodeName };
  }
  const expectedText = directText(expected);
  const actualText = directText(actual);
  if (expectedText !== actualText) {
    return { path: here, kind: 'text', expected: expectedText, actual: actualText };
  }
  return null;
}

function elementChildren(node) {
  return (node.childNodes ?? []).filter((child) => child.tagName);
}

function directText(node) {
  return (node.childNodes ?? [])
    .filter((child) => child.nodeName === '#text')
    .map((child) => child.value)
    .join('')
    .trim();
}

function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}
