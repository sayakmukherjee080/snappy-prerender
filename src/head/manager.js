import { headKey, mergeHeadEntries } from './tags.js';

const OWNER_ATTRIBUTE = 'data-snappy-head';
const CREATED_ATTRIBUTE = 'data-snappy-head-created';
const stack = [];
const snapshots = new WeakMap();
const createdElements = new WeakSet();
const originals = readRecordedOriginals();

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
 * Removes a Head's contribution and releases the tags it owned, so leaving a route does not
 * leave that route's metadata behind.
 */
export function unregisterHead(id) {
  const index = stack.findIndex((item) => item.id === id);
  if (index === -1) return;
  stack.splice(index, 1);
  applyMerged();
}

// Brings the head in line with the merged entries: create, adopt or update each tag, drop
// duplicates of the same identity, release tags that are no longer wanted, then restore a
// deterministic order.
function applyMerged() {
  if (typeof document === 'undefined' || !document.head) return;
  const head = document.head;
  const merged = mergeHeadEntries(stack);
  const desired = new Map(merged.map((entry) => [headKey(entry), entry]));

  for (const [key, entry] of desired) {
    const matches = findTags(head, key);
    const element = matches[0] ?? createTag(head, entry);
    writeTag(element, entry, key);
    // A second tag with the same identity is one the page should not ship twice. Titles are
    // exempt: React 19 native metadata and the head layer can each write one.
    if (key !== 'title') {
      for (const duplicate of matches.slice(1)) removeDuplicate(duplicate, key);
    }
  }

  for (const element of [...head.querySelectorAll(`[${OWNER_ATTRIBUTE}]`)]) {
    const key = element.getAttribute(OWNER_ATTRIBUTE);
    if (!desired.has(key)) releaseTag(element, key);
  }

  orderTags(head, merged);
}

/**
 * Finds every tag a key refers to, in document order. Matching on the attribute a crawler
 * reads means a tag already in the document — including one in prerendered HTML — is
 * updated in place instead of duplicated.
 */
function findTags(head, key) {
  if (key === 'title') {
    const title = head.querySelector('title');
    return title ? [title] : [];
  }
  const [kind, attribute, ...rest] = key.split(':');
  const value = rest.join(':');
  if (
    kind === 'meta' &&
    (attribute === 'name' || attribute === 'property' || attribute === 'http-equiv')
  ) {
    return [...head.querySelectorAll(`meta[${attribute}="${cssEscape(value)}"]`)];
  }
  if (kind === 'link' && attribute === 'rel') return findRelLinks(head, value);
  const owned = head.querySelector(`[${OWNER_ATTRIBUTE}="${cssEscape(key)}"]`);
  return owned ? [owned] : [];
}

// Matches links by rel, and by href when the key carries one, so two links that share a rel
// but point elsewhere stay distinct.
function findRelLinks(head, value) {
  const [rel, href] = value.split('|');
  const links = [...head.querySelectorAll(`link[rel="${cssEscape(rel)}"]`)];
  if (href === undefined) return links;
  return links.filter((link) => link.getAttribute('href') === href);
}

function createTag(head, entry) {
  const element = document.createElement(entry.kind);
  createdElements.add(element);
  head.appendChild(element);
  return element;
}

// Drops a tag that repeats an identity already rendered, leaving tags owned under another
// key alone so a shared element is never removed by mistake.
function removeDuplicate(element, key) {
  const owner = element.getAttribute(OWNER_ATTRIBUTE);
  if (owner !== null && owner !== key) return;
  element.remove();
}

// Writes the entry onto its element and marks the element as owned, pruning attributes that
// are no longer part of the entry. A tag the head layer created is also marked, so a later
// page load can still tell it apart from one the app wrote and remove rather than restore it.
function writeTag(element, entry, key) {
  snapshotTag(element, key);
  element.setAttribute(OWNER_ATTRIBUTE, key);
  if (createdElements.has(element)) element.setAttribute(CREATED_ATTRIBUTE, '');
  if (entry.kind === 'title') {
    element.textContent = entry.text;
    return;
  }
  for (const attribute of [...element.attributes]) {
    if (attribute.name === OWNER_ATTRIBUTE || attribute.name === CREATED_ATTRIBUTE) continue;
    if (!Object.hasOwn(entry.attrs, attribute.name)) element.removeAttribute(attribute.name);
  }
  for (const [name, value] of Object.entries(entry.attrs)) element.setAttribute(name, value);
}

// Remembers what a tag looked like before the head layer first touched it, so an app-owned
// tag can be handed back unchanged once no Head wants it any more. App-owned tags are also
// recorded under a global the prerenderer picks up, so the generated HTML can carry the
// original and a later page load can still hand the app's tag back.
function snapshotTag(element, key) {
  if (snapshots.has(element)) return;
  const attrs = new Map();
  for (const attribute of element.attributes) {
    if (attribute.name === OWNER_ATTRIBUTE || attribute.name === CREATED_ATTRIBUTE) continue;
    attrs.set(attribute.name, attribute.value);
  }
  const snapshot = {
    attrs: Object.fromEntries(attrs),
    text: element.tagName === 'TITLE' ? element.textContent : null,
  };
  snapshots.set(element, snapshot);
  if (createdElements.has(element) || element.hasAttribute(CREATED_ATTRIBUTE)) return;
  // A record from an earlier prerender stays as it is, so a rerun over already generated
  // output reproduces the same bytes instead of recording its own output as the original.
  if (key in originals) return;
  originals[key] = snapshot;
  if (typeof window !== 'undefined') window.__snappyHeadOriginals = originals;
}

// Reads the originals an earlier prerender baked into the page.
function readRecordedOriginals() {
  const recorded = typeof window === 'undefined' ? null : window.__SNAPPY_META__?.originals;
  return recorded && typeof recorded === 'object' ? { ...recorded } : {};
}

// Removes a tag the head layer created, including one generated in an earlier prerender, or
// restores an adopted tag to the state it was in before the head layer wrote to it, which
// hands the app's own metadata back.
function releaseTag(element, key) {
  if (createdElements.has(element) || element.hasAttribute(CREATED_ATTRIBUTE)) {
    element.remove();
    return;
  }
  // A record baked into the page by a prerender beats this session's snapshot, because the
  // markup already holds the head layer's output rather than the app's own value.
  const restore = readRecordedOriginal(key) ?? snapshots.get(element) ?? null;
  if (!restore) {
    element.remove();
    return;
  }
  applySnapshot(element, restore);
  snapshots.delete(element);
}

// Reads the original attributes a previous prerender recorded for a key.
function readRecordedOriginal(key) {
  const defaults = typeof window === 'undefined' ? null : window.__SNAPPY_META__;
  return (defaults?.originals ?? null)?.[key] ?? null;
}

// Replaces every attribute and the text of a tag with a recorded snapshot.
function applySnapshot(element, snapshot) {
  for (const name of [...element.attributes].map((attribute) => attribute.name)) {
    element.removeAttribute(name);
  }
  for (const [name, value] of Object.entries(snapshot.attrs ?? {})) {
    element.setAttribute(name, value);
  }
  if (snapshot.text !== null && snapshot.text !== undefined) element.textContent = snapshot.text;
}

// Re-appends owned tags in merged order, so the emitted head is identical between runs
// regardless of the order in which components first rendered their tags.
function orderTags(head, merged) {
  const order = merged.flatMap((entry) => findTags(head, headKey(entry)));
  const owned = [...head.querySelectorAll(`[${OWNER_ATTRIBUTE}]`)];
  const sameOrder =
    owned.length === order.length && owned.every((element, index) => element === order[index]);
  if (sameOrder) return;
  for (const element of order) head.appendChild(element);
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}
