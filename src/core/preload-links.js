import path from 'node:path';
import { parse, serialize } from 'parse5';
import { toPublicPath } from './routes.js';

/**
 * Injects static preload hints into the final HTML. Static hosts cannot send the
 * preload-manifest headers, so this is the page-level equivalent for runtime chunks,
 * fonts and the LCP image.
 */
export function injectPreloadLinks(html, options = {}) {
  if (options.scripts?.length === 0 && options.fonts?.size === 0 && !options.lcpImage) {
    return html;
  }
  const document = parse(html);
  const added = injectPreloadLinksInto(document, options);
  return added > 0 ? serialize(document) : html;
}

/**
 * Injects preload hints into a parsed document and reports how many were added.
 * Keeping this separate lets the write pipeline parse the page once for all final
 * post-processing steps.
 */
export function injectPreloadLinksInto(
  document,
  {
    scripts = [],
    fonts = new Map(),
    lcpImage = null,
    base = '/',
    ignoreForPreload = [],
    skipScripts = new Set(),
  } = {},
) {
  const head = findHead(document);
  if (!head) return 0;
  const existingScripts = new Set();
  const hints = new Set();

  const walk = (node) => {
    if (node.tagName === 'script') {
      const src = attribute(node, 'src');
      if (src) existingScripts.add(src);
    }
    if (node.tagName === 'link') {
      const href = attribute(node, 'href');
      if (href && attribute(node, 'rel').split(/\s+/).includes('preload')) hints.add(href);
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);

  const ignored = new Set(ignoreForPreload);
  let added = 0;
  const add = (element, href) => {
    if (hints.has(href) || ignored.has(path.posix.basename(href))) return;
    hints.add(href);
    head.childNodes.push(element);
    added += 1;
  };

  for (const script of [...scripts].sort()) {
    const href = toPublicPath(script, base);
    if (existingScripts.has(href) || skipScripts.has(href)) continue;
    add(
      linkNode([
        { name: 'rel', value: 'modulepreload' },
        { name: 'href', value: href },
      ]),
      href,
    );
  }
  for (const [font, contentType] of [...fonts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const href = toPublicPath(font, base);
    const attrs = [
      { name: 'rel', value: 'preload' },
      { name: 'as', value: 'font' },
      { name: 'href', value: href },
      { name: 'crossorigin', value: '' },
    ];
    if (contentType) attrs.push({ name: 'type', value: contentType });
    add(linkNode(attrs), href);
  }
  if (lcpImage) {
    const href = toPublicPath(lcpImage, base);
    add(
      linkNode([
        { name: 'rel', value: 'preload' },
        { name: 'as', value: 'image' },
        { name: 'href', value: href },
        { name: 'fetchpriority', value: 'high' },
      ]),
      href,
    );
  }
  return added;
}

// Collects script src values from an already parsed document.
export function collectScriptSourcesFromDocument(document) {
  const sources = new Set();
  const walk = (node) => {
    if (node.tagName === 'script') {
      const src = attribute(node, 'src');
      if (src) sources.add(src);
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
  return sources;
}

function findHead(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  return (html?.childNodes ?? []).find((node) => node.tagName === 'head') ?? null;
}

function linkNode(attrs) {
  return {
    nodeName: 'link',
    tagName: 'link',
    attrs,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes: [],
    parentNode: null,
  };
}

function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}
