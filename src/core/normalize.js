import { parse, serialize } from 'parse5';

const FREEZE_STYLE_ID = 'snappy-freeze';
const REMOVE_ATTRIBUTE = 'data-prerender-remove';

/**
 * Cleans the browser-serialised DOM before it is written to disk: strips the
 * injected animation-freezing style, removes elements marked for removal, and drops
 * duplicate style tags emitted by CSS-in-JS runtimes. Duplicate detection is scoped
 * to the document head so legitimate identical styles in the body survive.
 */
export function normaliseHtml(html) {
  const document = parse(html);
  const stats = { removedElements: 0, dedupedStyles: 0 };
  const seenStyles = new Set();
  cleanChildren(document, stats, seenStyles, false);
  return { html: serialize(document), stats };
}

// Rebuilds a node's child list, dropping marked nodes and duplicate head styles.
function cleanChildren(parent, stats, seenStyles, inHead) {
  const children = parent.childNodes ?? [];
  const kept = [];
  for (const child of children) {
    const childInHead = inHead || child.tagName === 'head';
    if (shouldRemove(child, stats)) continue;
    if (childInHead && child.tagName === 'style' && dedupeStyle(child, stats, seenStyles)) continue;
    cleanChildren(child, stats, seenStyles, childInHead);
    if (child.content) cleanChildren(child.content, stats, seenStyles, childInHead);
    kept.push(child);
  }
  parent.childNodes = kept;
}

// Reports whether a node is the injected freeze style or marked for removal.
function shouldRemove(node, stats) {
  if (node.tagName === 'style' && hasAttribute(node, 'id', FREEZE_STYLE_ID)) {
    stats.removedElements += 1;
    return true;
  }
  if (hasAttribute(node, REMOVE_ATTRIBUTE, null)) {
    stats.removedElements += 1;
    return true;
  }
  return false;
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

// Reads an attribute, optionally requiring an exact value.
function hasAttribute(node, name, value) {
  const attribute = node.attrs?.find((candidate) => candidate.name === name);
  if (!attribute) return false;
  return value === null || attribute.value === value;
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
