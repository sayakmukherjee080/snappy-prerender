import { headKey, mergeHeadEntries } from './tags.js';

const OWNER_ATTRIBUTE = 'data-snappy-head';
const CREATED_ATTRIBUTE = 'data-snappy-head-created';
const ATTRIBUTE_KINDS = new Set(['html', 'body', 'titleAttribute']);
const ORIGINAL_HTML = '__html';
const ORIGINAL_BODY = '__body';
const ORIGINAL_TITLE = '__title';
const stack = [];
const snapshots = new WeakMap();
const createdElements = new WeakSet();
const adoptedElements = new WeakSet();
const recorded = readRecordedOriginals();
const originals = { ...recorded };
delete originals[ORIGINAL_HTML];
delete originals[ORIGINAL_BODY];
delete originals[ORIGINAL_TITLE];
const htmlOriginals = new Map(Object.entries(recorded[ORIGINAL_HTML] ?? {}));
const bodyOriginals = new Map(Object.entries(recorded[ORIGINAL_BODY] ?? {}));
const titleOriginals = new Map(Object.entries(recorded[ORIGINAL_TITLE] ?? {}));
let previousState = null;
let externalTitleElement = null;
publishOriginals();

/**
 * Reads the metadata defaults the prerenderer persisted: an inert JSON script once the page
 * carries one, or the init-script global while prerendering, before that element exists.
 */
export function readMetadataDefaults() {
  const element =
    typeof document === 'undefined' ? null : document.querySelector('script[data-snappy-meta]');
  if (element) {
    try {
      return JSON.parse(element.textContent) ?? {};
    } catch {
      return {};
    }
  }
  return typeof window === 'undefined' ? {} : (window.__SNAPPY_META__ ?? {});
}

/**
 * Registers one mounted Head's tag list and reconciles the document head with the merged
 * result. Called on every render, so a client-side route change updates the head without a
 * page load. The optional callback observes real DOM changes only.
 */
export function registerHead(id, sequence, entries, onChangeClientState = null) {
  const index = stack.findIndex((item) => item.id === id);
  const item = { id, sequence, entries, onChangeClientState };
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
// duplicates of the same identity, release tags that are no longer wanted, apply element
// attributes, then restore a deterministic order.
function applyMerged() {
  if (typeof document === 'undefined' || !document.head) return;
  const head = document.head;
  const merged = mergeHeadEntries(stack);
  const headEntries = merged.filter((entry) => !ATTRIBUTE_KINDS.has(entry.kind));
  const htmlEntries = merged.filter((entry) => entry.kind === 'html');
  const bodyEntries = merged.filter((entry) => entry.kind === 'body');
  const titleEntries = merged.filter((entry) => entry.kind === 'titleAttribute');
  const desired = new Map(headEntries.map((entry) => [headKey(entry), entry]));
  const skipTitle = adoptExternalTitle(head, desired.get('title'));

  for (const [key, entry] of desired) {
    if (key === 'title' && skipTitle) continue;
    const matches = findTags(head, key, entry);
    const element = matches[0] ?? createTag(head, entry);
    writeTag(element, entry, key);
    // A second tag with the same identity is one the page should not ship twice.
    if (matches.length > 1) {
      for (const duplicate of matches.slice(1)) removeDuplicate(duplicate, key);
    }
  }

  for (const element of [...head.querySelectorAll(`[${OWNER_ATTRIBUTE}]`)]) {
    const key = element.getAttribute(OWNER_ATTRIBUTE);
    if (!desired.has(key)) releaseTag(element, key);
  }

  applyAttributes(document.documentElement, htmlEntries, htmlOriginals);
  applyAttributes(document.body, bodyEntries, bodyOriginals);
  applyTitleAttributes(head, titleEntries);
  orderTags(head, headEntries);
  notifyState(merged);
}

// Leaves an already-correct, app-owned title untouched. React 19 hoists native titles and
// removes them on navigation itself; adopting that node would make React's own removal fail.
// A title whose text already matches is therefore treated as externally owned.
function adoptExternalTitle(head, entry) {
  if (!entry) {
    externalTitleElement = null;
    return false;
  }
  const titles = [...head.querySelectorAll('title')];
  const external = titles.find(
    (title) =>
      !title.hasAttribute(OWNER_ATTRIBUTE) &&
      !title.hasAttribute(CREATED_ATTRIBUTE) &&
      !snapshots.has(title) &&
      title.textContent === entry.text,
  );
  if (!external) {
    externalTitleElement = null;
    return false;
  }
  externalTitleElement = external;
  for (const title of titles) {
    if (title !== external) title.remove();
  }
  return true;
}

// Applies title attributes, leaving them alone when the document has no title to decorate.
function applyTitleAttributes(head, entries) {
  const title = head.querySelector('title');
  if (!title || title === externalTitleElement) return;
  applyAttributes(title, entries, titleOriginals);
}

// Applies one attribute family to an element and restores the original value once no Head
// wants the attribute any more. Recorded values survive a prerender so client navigation
// can restore what the document shipped with.
function applyAttributes(element, entries, originals) {
  if (!element) return;
  const desired = new Map(entries.map((entry) => [entry.key, String(entry.value)]));
  for (const [key, value] of desired) {
    const current = element.getAttribute(key);
    // Record only a real change. When the Head writes the value the document already had,
    // leaving it in place after unmount is the correct restoration.
    if (!originals.has(key) && current !== value) {
      originals.set(key, current);
      publishOriginals();
    }
    element.setAttribute(key, value);
  }
  for (const key of [...originals.keys()]) {
    if (desired.has(key)) continue;
    const previous = originals.get(key);
    if (previous === null) element.removeAttribute(key);
    else element.setAttribute(key, previous);
    originals.delete(key);
    publishOriginals();
  }
}

/**
 * Finds every tag a key refers to, in document order. Matching on the attribute a crawler
 * reads means a tag already in the document — including one in prerendered HTML or hoisted
 * by React 19 — is updated in place instead of duplicated.
 */
function findTags(head, key, entry) {
  if (key === 'title') {
    // Prefer the last title so a React 19 hoisted title keeps its DOM node and the older
    // template title is the one removed as a duplicate.
    return [...head.querySelectorAll('title')].reverse();
  }
  const owned = head.querySelector(`[${OWNER_ATTRIBUTE}="${cssEscape(key)}"]`);
  if (owned) return [owned];
  if (entry?.match) {
    const matches = [...head.querySelectorAll(entry.kind)].filter((element) =>
      entry.match.every(([name, value]) => element.getAttribute(name) === value),
    );
    if (matches.length > 0) return matches;
    if (entry.adopt) {
      return [...head.querySelectorAll(entry.kind)]
        .filter(
          (element) =>
            element.getAttribute(OWNER_ATTRIBUTE) === null &&
            entry.adopt.every(([name, value]) => element.getAttribute(name) === value),
        )
        .slice(0, 1);
    }
    return [];
  }
  return findUntrackedTag(head, entry);
}

// Finds an app-written script, style, noscript or base tag by the content it carries, so
// repeated renders adopt the same element instead of appending a copy.
function findUntrackedTag(head, entry) {
  if (entry.kind === 'base') {
    const base = head.querySelector('base');
    return base ? [base] : [];
  }
  if (entry.kind === 'script') {
    const src = entry.attrs?.src;
    const scripts = [...head.querySelectorAll('script')];
    if (src) {
      const match = scripts.find((element) => element.getAttribute('src') === src);
      return match ? [match] : [];
    }
    const text = unescapeClosingTag(entry.text ?? '', 'script');
    const match = scripts.find((element) => element.textContent === text);
    return match ? [match] : [];
  }
  if (entry.kind === 'style') {
    const text = unescapeClosingTag(entry.text ?? '', 'style');
    const match = [...head.querySelectorAll('style')].find(
      (element) => element.textContent === text,
    );
    return match ? [match] : [];
  }
  if (entry.kind === 'noscript') {
    const html = entry.html ?? entry.text ?? '';
    const match = [...head.querySelectorAll('noscript')].find(
      (element) => element.innerHTML === html,
    );
    return match ? [match] : [];
  }
  return [];
}

// Creates the element for an entry and records that the head layer owns it.
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
  if (!createdElements.has(element) && !element.hasAttribute(CREATED_ATTRIBUTE)) {
    adoptedElements.add(element);
  }
  element.setAttribute(OWNER_ATTRIBUTE, key);
  if (createdElements.has(element)) element.setAttribute(CREATED_ATTRIBUTE, '');
  if (entry.kind === 'title') {
    if (element.textContent !== entry.text) element.textContent = entry.text;
    return;
  }
  for (const attribute of [...element.attributes]) {
    if (attribute.name === OWNER_ATTRIBUTE || attribute.name === CREATED_ATTRIBUTE) continue;
    if (!Object.hasOwn(entry.attrs ?? {}, attribute.name)) element.removeAttribute(attribute.name);
  }
  for (const [name, value] of Object.entries(entry.attrs ?? {})) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  if (entry.kind === 'script' || entry.kind === 'style') {
    const text = entry.text ?? '';
    if (element.textContent !== text) element.textContent = text;
    return;
  }
  if (entry.kind === 'noscript') {
    if (entry.html !== undefined) {
      if (element.innerHTML !== entry.html) element.innerHTML = entry.html;
    } else if (element.textContent !== (entry.text ?? '')) {
      element.textContent = entry.text ?? '';
    }
  }
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
    text: ['TITLE', 'SCRIPT', 'STYLE'].includes(element.tagName) ? element.textContent : null,
  };
  if (element.tagName === 'NOSCRIPT') snapshot.html = element.innerHTML;
  snapshots.set(element, snapshot);
  if (createdElements.has(element) || element.hasAttribute(CREATED_ATTRIBUTE)) return;
  // A record from an earlier prerender stays as it is, so a rerun over already generated
  // output reproduces the same bytes instead of recording its own output as the original.
  if (key in originals) return;
  originals[key] = snapshot;
  publishOriginals();
}

// Mirrors the recorded originals into a global the prerenderer picks up, so the generated
// HTML can carry them and a later page load can hand the app's own tags back. Attribute
// families use reserved keys so they travel beside the tag records.
function publishOriginals() {
  if (typeof window === 'undefined') return;
  window.__snappyHeadOriginals = {
    ...originals,
    ...(htmlOriginals.size > 0 ? { [ORIGINAL_HTML]: Object.fromEntries(htmlOriginals) } : {}),
    ...(bodyOriginals.size > 0 ? { [ORIGINAL_BODY]: Object.fromEntries(bodyOriginals) } : {}),
    ...(titleOriginals.size > 0 ? { [ORIGINAL_TITLE]: Object.fromEntries(titleOriginals) } : {}),
  };
}

// Reads the originals an earlier prerender baked into the page.
function readRecordedOriginals() {
  const recorded = readMetadataDefaults().originals;
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
  return key in originals ? originals[key] : null;
}

// Replaces every attribute, the text and the inner markup of a tag with a recorded snapshot.
function applySnapshot(element, snapshot) {
  for (const name of [...element.attributes].map((attribute) => attribute.name)) {
    element.removeAttribute(name);
  }
  for (const [name, value] of Object.entries(snapshot.attrs ?? {})) {
    element.setAttribute(name, value);
  }
  if (snapshot.html !== null && snapshot.html !== undefined) {
    element.innerHTML = snapshot.html;
  } else if (snapshot.text !== null && snapshot.text !== undefined) {
    element.textContent = snapshot.text;
  }
}

// Re-appends owned tags in merged order, so the emitted head is identical between runs
// regardless of the order in which components first rendered their tags.
function orderTags(head, merged) {
  const order = merged
    .flatMap((entry) => findTags(head, headKey(entry), entry))
    .filter((element) => element !== externalTitleElement && !adoptedElements.has(element));
  const owned = [...head.querySelectorAll(`[${OWNER_ATTRIBUTE}]`)].filter(
    (element) => !adoptedElements.has(element),
  );
  const sameOrder =
    owned.length === order.length && owned.every((element, index) => element === order[index]);
  if (sameOrder) return;
  for (const element of order) head.appendChild(element);
}

// Compares the merged entries with the previous pass and reports real additions, removals
// and value changes. A render that produces the same head never calls a callback.
function notifyState(merged) {
  const current = new Map(
    merged.map((entry) => [headKey(entry), { signature: entrySignature(entry), entry }]),
  );
  const previous = previousState;
  previousState = current;
  if (!previous) {
    if (current.size === 0) return;
    runCallbacks(
      buildState(merged),
      [...current.values()].map((item) => describeEntry(item.entry)),
      [],
    );
    return;
  }
  const added = [];
  const removed = [];
  for (const [key, item] of current) {
    const before = previous.get(key);
    if (!before || before.signature !== item.signature) added.push(describeEntry(item.entry));
  }
  for (const [key, item] of previous) {
    const after = current.get(key);
    if (!after || after.signature !== item.signature) removed.push(describeEntry(item.entry));
  }
  if (added.length === 0 && removed.length === 0) return;
  runCallbacks(buildState(merged), added, removed);
}

// Groups the merged entries by the shape documented for onChangeClientState.
function buildState(merged) {
  const state = {
    title: null,
    meta: [],
    link: [],
    script: [],
    style: [],
    noscript: [],
    base: [],
    htmlAttributes: [],
    bodyAttributes: [],
    titleAttributes: [],
  };
  for (const entry of merged) {
    const descriptor = describeEntry(entry);
    if (entry.kind === 'title') state.title = descriptor;
    else if (entry.kind === 'html') state.htmlAttributes.push(descriptor);
    else if (entry.kind === 'body') state.bodyAttributes.push(descriptor);
    else if (entry.kind === 'titleAttribute') state.titleAttributes.push(descriptor);
    else state[entry.kind]?.push(descriptor);
  }
  return state;
}

// Converts one entry into the public callback descriptor, without internal match data.
function describeEntry(entry) {
  const descriptor = { kind: entry.kind, key: headKey(entry) };
  if (entry.attrs) descriptor.attrs = { ...entry.attrs };
  if (entry.text !== undefined) descriptor.text = entry.text;
  if (entry.html !== undefined) descriptor.html = entry.html;
  if (entry.value !== undefined) descriptor.value = entry.value;
  return descriptor;
}

// Captures everything that affects the rendered DOM, ignoring internal matching helpers.
function entrySignature(entry) {
  return JSON.stringify([
    headKey(entry),
    entry.kind,
    entry.key ?? null,
    entry.attrs ?? null,
    entry.text ?? null,
    entry.html ?? null,
    entry.value ?? null,
  ]);
}

// Calls each mounted Head's callback once per change. A callback that throws is rethrown
// asynchronously so one observer cannot stop the head from reconciling.
function runCallbacks(state, added, removed) {
  const callbacks = [...new Set(stack.map((item) => item.onChangeClientState).filter(Boolean))];
  for (const callback of callbacks) {
    try {
      callback(state, added, removed);
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

// Reverses escapeClosingTag so an app-written element can be recognised by its real text.
function unescapeClosingTag(text, tag) {
  return text.replace(new RegExp(`<\\\\/${tag}`, 'gi'), (match) => `</${match.slice(3)}`);
}

// Escapes a value for use inside an attribute selector, including control characters.
function cssEscape(value) {
  return String(value).replace(/["\\\n\r\f]/g, (char) => {
    if (char === '\n') return '\\a ';
    if (char === '\r') return '\\d ';
    if (char === '\f') return '\\c ';
    return `\\${char}`;
  });
}
