import { parse } from 'parse5';

const DATA_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Reads the metadata and structural markers from a final HTML string.
 */
export function collectPageMeta(html) {
  return collectPageMetaFromDocument(parse(html));
}

/**
 * Reads metadata from an already parsed document. Used by the write pipeline so the
 * final HTML is parsed once instead of once per post-processing step.
 */
export function collectPageMetaFromDocument(document) {
  const meta = {
    title: null,
    titleCount: 0,
    description: null,
    canonical: null,
    robots: null,
    noindex: false,
    lang: null,
    dir: null,
    ogLocale: null,
    h1Count: 0,
    alternates: [],
    images: [],
    inlineStyleAttributes: 0,
  };
  const visitedLinks = new Set();

  const walk = (node) => {
    if (node.tagName === 'html') {
      meta.lang = attribute(node, 'lang') || null;
      meta.dir = attribute(node, 'dir') || null;
    }
    // An SVG <title> names a drawing, not the document, so it must not count as a page title.
    if (node.tagName === 'title' && node.namespaceURI !== SVG_NAMESPACE) {
      meta.titleCount += 1;
      if (meta.title === null) meta.title = textContent(node);
    }
    if (node.tagName === 'meta') {
      const name = attribute(node, 'name').toLowerCase();
      const property = attribute(node, 'property').toLowerCase();
      const content = attribute(node, 'content');
      if (name === 'description' && meta.description === null) meta.description = content;
      if (property === 'og:locale' && meta.ogLocale === null) meta.ogLocale = content;
      if (name === 'robots') {
        meta.robots ??= content;
        if (/\b(noindex|none)\b/i.test(content)) meta.noindex = true;
      }
    }
    if (node.tagName === 'link') {
      const rel = attribute(node, 'rel').toLowerCase();
      if (rel === 'canonical' && meta.canonical === null) meta.canonical = attribute(node, 'href');
      if (rel.split(/\s+/).includes('alternate')) {
        const hreflang = attribute(node, 'hreflang');
        const href = attribute(node, 'href');
        if (hreflang && href) {
          const key = `${hreflang}|${href}`;
          if (!visitedLinks.has(key)) {
            visitedLinks.add(key);
            meta.alternates.push({ hreflang, href });
          }
        }
      }
    }
    if (node.tagName === 'h1') meta.h1Count += 1;
    if (node.tagName === 'img') {
      addImage(meta, attribute(node, 'src'));
      for (const candidate of srcsetCandidates(attribute(node, 'srcset')))
        addImage(meta, candidate);
    }
    if (node.tagName === 'source' && node.parentNode?.tagName === 'picture') {
      addImage(meta, attribute(node, 'src'));
      for (const candidate of srcsetCandidates(attribute(node, 'srcset')))
        addImage(meta, candidate);
    }
    for (const attr of node.attrs ?? []) {
      if (attr.name === 'style' && attr.value.trim().length > 0) meta.inlineStyleAttributes += 1;
    }
    for (const child of node.childNodes ?? []) walk(child);
  };

  walk(document);
  return meta;
}

// Adds a usable image URL once. Data URLs have no host to list in a sitemap.
function addImage(meta, value) {
  if (!value || DATA_URL.test(value) || meta.images.includes(value)) return;
  meta.images.push(value);
}

// Extracts URL candidates from a srcset, ignoring their density or width descriptors.
function srcsetCandidates(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(
      (candidate) => candidate.length > 0 && !DATA_URL.test(candidate) && !/[<>]/.test(candidate),
    );
}

// Reads an attribute value, defaulting to an empty string.
function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

// Concatenates the text beneath a node.
function textContent(node) {
  let text = '';
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') text += child.value;
    else text += textContent(child);
  }
  return text.trim();
}
