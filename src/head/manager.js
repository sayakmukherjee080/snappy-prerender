import { headKey, mergeHeadEntries } from './tags.js';

const OWNER_ATTRIBUTE = 'data-snappy-head';
const stack = [];

/**
 * Registers one mounted Head's tag list and reconciles the document head with the merged
 * result. Called on every render, so a client-side route change updates the head without a
 * page load.
 */
export function registerHead(id, sequence, entries) {
  const index = stack.findIndex((item) => item.id === id);
  const item = { id, sequence, entries };
  if (index === -1) stack.push(item);
  else stack[index] = item;
  applyMerged();
}

/**
 * Removes a Head's contribution and drops the tags it owned, so leaving a route does not
 * leave that route's metadata behind.
 */
export function unregisterHead(id) {
  const index = stack.findIndex((item) => item.id === id);
  if (index === -1) return;
  stack.splice(index, 1);
  applyMerged();
}

// Brings the head in line with the merged entries: create, adopt or update each tag, then
// remove tags this module owns that are no longer wanted.
function applyMerged() {
  if (typeof document === 'undefined' || !document.head) return;
  const head = document.head;
  const merged = mergeHeadEntries(stack);
  const desired = new Map(merged.map((entry) => [headKey(entry), entry]));

  for (const [key, entry] of desired) {
    const element = findTag(head, key) ?? createTag(head, entry);
    writeTag(element, entry, key);
  }

  for (const element of [...head.querySelectorAll(`[${OWNER_ATTRIBUTE}]`)]) {
    if (!desired.has(element.getAttribute(OWNER_ATTRIBUTE))) element.remove();
  }
}

/**
 * Finds the tag a key refers to. Matching on the attribute a crawler reads means a tag
 * already in the document — including one in prerendered HTML — is updated instead of
 * duplicated.
 */
function findTag(head, key) {
  if (key === 'title') return head.querySelector('title');
  const [kind, attribute, ...rest] = key.split(':');
  const value = rest.join(':');
  if (kind === 'meta' && (attribute === 'name' || attribute === 'property')) {
    return head.querySelector(`meta[${attribute}="${cssEscape(value)}"]`);
  }
  if (kind === 'link' && attribute === 'rel') {
    return head.querySelector(`link[rel="${cssEscape(value)}"]`);
  }
  return head.querySelector(`[${OWNER_ATTRIBUTE}="${cssEscape(key)}"]`);
}

function createTag(head, entry) {
  const element = document.createElement(entry.kind);
  head.appendChild(element);
  return element;
}

// Writes the entry onto its element and marks the element as owned, pruning attributes that
// are no longer part of the entry.
function writeTag(element, entry, key) {
  element.setAttribute(OWNER_ATTRIBUTE, key);
  if (entry.kind === 'title') {
    element.textContent = entry.text;
    return;
  }
  for (const attribute of [...element.attributes]) {
    if (attribute.name === OWNER_ATTRIBUTE) continue;
    if (!(attribute.name in entry.attrs)) element.removeAttribute(attribute.name);
  }
  for (const [name, value] of Object.entries(entry.attrs)) element.setAttribute(name, value);
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}
