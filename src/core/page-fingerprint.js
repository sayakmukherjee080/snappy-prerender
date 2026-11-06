import { createHash } from 'node:crypto';
import { collectPageMetaFromDocument } from './page-meta.js';

const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
const PAGE_META_KEYS = ['title', 'description', 'canonical', 'robots', 'lang', 'dir', 'h1Count'];

/**
 * Builds the semantic fingerprint used by drift detection and sitemap lastmod. It
 * deliberately ignores script text, style text and hashed asset URLs, so a bundle or
 * minifier change does not masquerade as page-content drift.
 * @param {object} document A parse5 document from the final written HTML.
 * @returns {{ contentHash: string, textLength: number, fingerprint: object }}
 */
export function fingerprintDocument(document) {
  const meta = collectPageMetaFromDocument(document);
  const fingerprint = {
    meta: Object.fromEntries(PAGE_META_KEYS.map((key) => [key, meta[key] ?? null])),
    alternates: meta.alternates ?? [],
    openGraph: [],
    twitter: [],
    h1: [],
    text: '',
    links: [],
    images: [],
    jsonLd: [],
  };
  const textParts = [];
  collectDocumentMetadata(document, fingerprint);
  const body = findBody(document);
  if (body) walk(body, { fingerprint, textParts });
  fingerprint.text = normalizeText(textParts.join(' '));
  const serialised = JSON.stringify(sortValue(fingerprint));
  return {
    contentHash: createHash('sha256').update(serialised).digest('hex'),
    textLength: fingerprint.text.length,
    fingerprint,
  };
}

/**
 * Walks the rendered document once, collecting the visible content and the metadata
 * that affects a crawler or a shared link.
 * @param {object} node
 * @param {{ fingerprint: object, textParts: string[] }} state
 */
function walk(node, state) {
  if (node.nodeName === '#text') {
    state.textParts.push(node.value);
    return;
  }
  const tag = node.tagName?.toUpperCase();
  if (!tag) {
    for (const child of node.childNodes ?? []) walk(child, state);
    return;
  }
  if (tag === 'SCRIPT') return;
  if (SKIP_TEXT.has(tag)) return;
  if (tag === 'H1') state.fingerprint.h1.push(normalizeText(textContent(node)));
  if (tag === 'A' && attribute(node, 'href')) state.fingerprint.links.push(attribute(node, 'href'));
  if (tag === 'IMG' && attribute(node, 'src')) {
    state.fingerprint.images.push({
      src: attribute(node, 'src'),
      alt: normalizeText(attribute(node, 'alt')),
    });
  }
  if (tag === 'SOURCE' && attribute(node, 'src')) {
    state.fingerprint.images.push({
      src: attribute(node, 'src'),
      alt: normalizeText(attribute(node, 'alt')),
    });
  }
  for (const child of node.childNodes ?? []) walk(child, state);
}

// Collects social metadata and JSON-LD from the whole document, including the head.
function collectDocumentMetadata(node, fingerprint) {
  if (node.nodeName === '#text') return;
  const tag = node.tagName?.toUpperCase();
  if (tag === 'META') {
    const name = attribute(node, 'name').toLowerCase();
    const property = attribute(node, 'property').toLowerCase();
    const content = attribute(node, 'content');
    if (property.startsWith('og:') && content) {
      fingerprint.openGraph.push({ key: property, content });
    }
    if (name.startsWith('twitter:') && content) {
      fingerprint.twitter.push({ key: name, content });
    }
  }
  if (tag === 'SCRIPT' && attribute(node, 'type').toLowerCase() === 'application/ld+json') {
    fingerprint.jsonLd.push(normalizeText(textContent(node)));
  }
  for (const child of node.childNodes ?? []) collectDocumentMetadata(child, fingerprint);
}

// Finds the body element in a parse5 document.
function findBody(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  return (html?.childNodes ?? []).find((node) => node.tagName === 'body') ?? null;
}

// Reads an attribute value, defaulting to an empty string.
function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

// Concatenates text beneath a node, skipping nested script and style content.
function textContent(node) {
  let text = '';
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') text += child.value;
    else if (!SKIP_TEXT.has(child.tagName?.toUpperCase())) text += textContent(child);
  }
  return text;
}

// Normalises the whitespace that differs between serialised and parsed documents.
function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sorts object keys recursively so the same content always produces the same hash.
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}
