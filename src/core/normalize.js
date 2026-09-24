import { parse, serialize } from 'parse5';

const FREEZE_STYLE_ID = 'snappy-freeze';
const REMOVE_ATTRIBUTE = 'data-prerender-remove';

/**
 * Cleans and post-processes the browser-serialised DOM before it is written to disk.
 * Always: strips the injected animation-freezing style, removes elements marked with
 * data-prerender-remove, and drops duplicate head styles emitted by CSS-in-JS.
 * Optionally: removes style or script tags, marks scripts async, drops dead blob
 * stylesheets, and adds preconnect and image preload hints.
 */
export function normaliseHtml(html, options = {}) {
  const document = parse(html);
  const stats = { removedElements: 0, dedupedStyles: 0, hints: 0, textSeparators: 0 };
  const seenStyles = new Set();
  cleanChildren(document, stats, seenStyles, false, options);

  const preconnectOrigins = options.preconnectOrigins ?? [];
  const preloadImages = options.preloadImages ?? [];
  if (preconnectOrigins.length > 0 || preloadImages.length > 0) {
    stats.hints = appendHints(document, { preconnectOrigins, preloadImages });
  }
  return { html: serialize(document), stats };
}

// Rebuilds a node's child list, dropping removed nodes, separating adjacent text nodes
// and de-duplicating head styles.
function cleanChildren(parent, stats, seenStyles, inHead, options) {
  const children = parent.childNodes ?? [];
  const kept = [];
  for (const child of children) {
    const childInHead = inHead || child.tagName === 'head';
    if (shouldRemove(child, stats, options)) continue;
    if (childInHead && child.tagName === 'style' && dedupeStyle(child, stats, seenStyles)) continue;
    if (options.asyncScriptTags && child.tagName === 'script') markScriptAsync(child);
    cleanChildren(child, stats, seenStyles, childInHead, options);
    if (child.content) cleanChildren(child.content, stats, seenStyles, childInHead, options);
    if (isText(kept[kept.length - 1]) && isText(child)) {
      kept.push(createComment());
      stats.textSeparators += 1;
    }
    kept.push(child);
  }
  parent.childNodes = kept;
}

// Reports whether a node is a text node.
function isText(node) {
  return node?.nodeName === '#text';
}

// Builds the comment node that keeps two text siblings apart, matching what React's
// own server rendering emits so hydration finds the same node boundaries.
function createComment() {
  return { nodeName: '#comment', data: ' ', parentNode: null };
}

// Reports whether a node is removed for any of the configured reasons.
function shouldRemove(node, stats, options) {
  const reason =
    (node.tagName === 'style' && hasAttribute(node, 'id', FREEZE_STYLE_ID)) ||
    hasAttribute(node, REMOVE_ATTRIBUTE, null) ||
    (options.removeStyleTags && node.tagName === 'style') ||
    (options.removeScriptTags && node.tagName === 'script') ||
    (options.removeBlobs && isBlobStylesheet(node));

  if (!reason) return false;
  stats.removedElements += 1;
  return true;
}

// Drops a style tag whose text was already seen, reporting it through stats.
function dedupeStyle(node, stats, seenStyles) {
  const text = textContent(node);
  if (seenStyles.has(text)) {
    stats.dedupedStyles += 1;
    return true;
  }
  seenStyles.add(text);
  return false;
}

// Adds async to external scripts that are neither async nor defer yet.
function markScriptAsync(node) {
  const attrs = node.attrs ?? [];
  if (!attrs.some((attribute) => attribute.name === 'src')) return;
  if (attrs.some((attribute) => attribute.name === 'async' || attribute.name === 'defer')) return;
  attrs.push({ name: 'async', value: '' });
}

// Reports whether a node is a stylesheet link pointing at a dead blob URL.
function isBlobStylesheet(node) {
  if (node.tagName !== 'link') return false;
  if (attributeValue(node, 'rel').toLowerCase() !== 'stylesheet') return false;
  return attributeValue(node, 'href').startsWith('blob:');
}

// Appends preconnect and image preload links to the head, skipping duplicates.
function appendHints(document, { preconnectOrigins, preloadImages }) {
  const head = findHead(document);
  if (!head) return 0;
  const existing = new Set(
    (head.childNodes ?? [])
      .filter((node) => node.tagName === 'link')
      .map((node) => `${attributeValue(node, 'rel')}|${attributeValue(node, 'href')}`),
  );

  let added = 0;
  for (const origin of preconnectOrigins) {
    if (existing.has(`preconnect|${origin}`)) continue;
    existing.add(`preconnect|${origin}`);
    head.childNodes.push(
      createElement('link', [
        { name: 'rel', value: 'preconnect' },
        { name: 'href', value: origin },
      ]),
    );
    added += 1;
  }
  for (const image of preloadImages) {
    if (existing.has(`preload|${image}`)) continue;
    existing.add(`preload|${image}`);
    head.childNodes.push(
      createElement('link', [
        { name: 'rel', value: 'preload' },
        { name: 'as', value: 'image' },
        { name: 'href', value: image },
      ]),
    );
    added += 1;
  }
  return added;
}

// Locates the head element of a parsed document.
function findHead(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  return (html?.childNodes ?? []).find((node) => node.tagName === 'head') ?? null;
}

// Builds a minimal parse5 element node for injection into the tree.
function createElement(tagName, attrs = []) {
  return {
    nodeName: tagName,
    tagName,
    attrs,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes: [],
    parentNode: null,
  };
}

// Reads an attribute, optionally requiring an exact value.
function hasAttribute(node, name, value) {
  const attribute = node.attrs?.find((candidate) => candidate.name === name);
  if (!attribute) return false;
  return value === null || attribute.value === value;
}

// Reads an attribute value, defaulting to an empty string.
function attributeValue(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value ?? '';
}

// Concatenates all text nodes beneath a node, used to compare style contents.
function textContent(node) {
  let text = '';
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') text += child.value;
    else text += textContent(child);
  }
  return text;
}
