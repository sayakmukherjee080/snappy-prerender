import { createHash } from 'node:crypto';
import { parse, serialize } from 'parse5';

// Types that execute as JavaScript. A script with any other type is data, not code.
const EXECUTABLE_TYPES = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'text/ecmascript',
  'module',
]);
const CSP_MARKER = 'data-snappy-csp';

/**
 * Adds a hash-based Content-Security-Policy meta tag covering every inline script and
 * style in the final document. A policy this function wrote on an earlier run is
 * replaced; a policy the app wrote is kept untouched, so the prerenderer never merges
 * two policies silently.
 */
export function applyCspHashes(html) {
  const document = parse(html);
  const result = applyCspHashesToDocument(document);
  return {
    html: result.existingPolicy ? html : serialize(document),
    ...result,
  };
}

/**
 * Applies the hash policy to an already parsed document. Returns counts and whether a
 * user-owned policy was left untouched.
 */
export function applyCspHashesToDocument(document) {
  const head = findHead(document);
  if (!head) return { hashedScripts: 0, hashedStyles: 0, existingPolicy: false };
  removeGeneratedPolicy(head);
  const existing = findPolicyMeta(head);
  if (existing) return { hashedScripts: 0, hashedStyles: 0, existingPolicy: true };

  const scriptHashes = [];
  const styleHashes = [];
  walk(document, (node) => {
    if (node.tagName === 'script' && isExecutableInline(node)) {
      scriptHashes.push(hashOf(textContent(node)));
    }
    if (node.tagName === 'style') {
      styleHashes.push(hashOf(textContent(node)));
    }
  });

  const directives = [
    `script-src 'self'${hashList(scriptHashes)}`,
    `style-src 'self'${hashList(styleHashes)}`,
  ];
  head.childNodes.unshift(metaNode(directives.join('; ')));
  return {
    hashedScripts: scriptHashes.length,
    hashedStyles: styleHashes.length,
    existingPolicy: false,
  };
}

// A script is executable inline code when it has no src and no data type.
function isExecutableInline(node) {
  if (attribute(node, 'src').length > 0) return false;
  const type = attribute(node, 'type').trim().toLowerCase();
  return EXECUTABLE_TYPES.has(type);
}

// Renders the hash list, deduplicated and in document order.
function hashList(hashes) {
  return [...new Set(hashes)].map((hash) => ` '${hash}'`).join('');
}

// Base64 SHA-256, the form a CSP hash source uses.
function hashOf(text) {
  return `sha256-${createHash('sha256').update(text).digest('base64')}`;
}

function findHead(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  return (html?.childNodes ?? []).find((node) => node.tagName === 'head') ?? null;
}

function findPolicyMeta(head) {
  return (head.childNodes ?? []).some(
    (node) =>
      node.tagName === 'meta' &&
      attribute(node, 'http-equiv').toLowerCase() === 'content-security-policy' &&
      !hasAttribute(node, CSP_MARKER),
  );
}

// Removes the policy this prerenderer wrote on an earlier run, so it is recomputed against
// the current document instead of being mistaken for an app-owned policy.
function removeGeneratedPolicy(head) {
  head.childNodes = (head.childNodes ?? []).filter(
    (node) => !(node.tagName === 'meta' && hasAttribute(node, CSP_MARKER)),
  );
}

function metaNode(content) {
  return {
    nodeName: 'meta',
    tagName: 'meta',
    attrs: [
      { name: 'http-equiv', value: 'Content-Security-Policy' },
      { name: 'content', value: content },
      { name: CSP_MARKER, value: '' },
    ],
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes: [],
    parentNode: null,
  };
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function textContent(node) {
  let text = '';
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') text += child.value;
    else text += textContent(child);
  }
  return text;
}

function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

function hasAttribute(node, name) {
  return Boolean(node.attrs?.some((entry) => entry.name === name));
}
