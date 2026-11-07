import fs from 'node:fs/promises';
import path from 'node:path';
import { hasImportRule, rewriteCssUrls } from './css-url.js';
import { minifyCss } from './minify.js';
import { toAppPath } from './resources.js';

const PAGE_ORIGIN = 'http://snappy.local';

/**
 * Inlines every same-origin stylesheet the page loaded, replacing the links with a
 * single style tag. Blob-backed stylesheets work too because the text is read from
 * the live page. Stylesheets that cannot be fetched, or that use @import, are left in
 * place. Relative url() values are rebased against each sheet before joining so fonts
 * and images keep working on nested routes.
 */
export async function inlineStylesheets({ page, minifyCssOptions, cache = null }) {
  const cachedCss = cache ? Object.fromEntries(cache) : {};
  const collected = await page.evaluate(async (knownCss) => {
    // Only media that applies on screen can be inlined without changing how the sheet
    // applies, so a print stylesheet is left as a link instead of becoming active.
    const INLINEABLE_MEDIA = new Set(['', 'all', 'screen']);
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(
      (link) => new URL(link.href).origin === location.origin,
    );
    const sheets = [];
    const skipped = [];
    for (const link of links) {
      const media = (link.getAttribute('media') ?? '').trim().toLowerCase();
      if (!INLINEABLE_MEDIA.has(media)) {
        skipped.push(link.href);
        continue;
      }
      if (Object.hasOwn(knownCss, link.href)) {
        sheets.push({ css: knownCss[link.href], href: link.href, fetched: false });
        continue;
      }
      try {
        const response = await fetch(link.href);
        if (!response.ok) throw new Error(String(response.status));
        sheets.push({ css: await response.text(), href: link.href, fetched: true });
      } catch {
        skipped.push(link.href);
      }
    }
    return { sheets, skipped };
  }, cachedCss);

  const inlineable = [];
  const skipped = [...collected.skipped];
  const fetched = [];
  for (const sheet of collected.sheets) {
    if (sheet.fetched) fetched.push({ href: sheet.href, css: sheet.css });
    if (hasImportRule(sheet.css)) skipped.push(sheet.href);
    else inlineable.push(sheet);
  }
  if (inlineable.length === 0) return { skipped, fetched };

  const pageOrigin = new URL(page.url()).origin;
  const joined = inlineable
    .map((sheet) => rewriteCssUrls(sheet.css, sheet.href, pageOrigin))
    .join('\n');
  const css = minifyCssOptions ? minifyCss(joined, minifyCssOptions) : joined;
  await page.evaluate(
    ({ text, hrefs }) => {
      const style = document.createElement('style');
      style.setAttribute('data-snappy-inline', '');
      style.textContent = text;
      document.head.appendChild(style);
      const inlined = new Set(hrefs);
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        if (inlined.has(link.href)) link.remove();
      }
    },
    { text: css, hrefs: inlineable.map((sheet) => sheet.href) },
  );
  return { skipped, fetched };
}

/**
 * Inlines vendored stylesheets that asset localization produced after the render pass.
 * The browser pass cannot fetch a cross-origin sheet safely, so this second pass reads
 * the local `snappy-assets/` file and replaces its link with one style tag.
 * @param {{ document: object, outputDir: string, base: string, minifyCssOptions?: object | null }} input
 * @returns {Promise<number>}
 */
export async function inlineLocalVendorStylesheets({
  document,
  outputDir,
  base,
  minifyCssOptions = null,
}) {
  const head = (document.childNodes ?? [])
    .find((node) => node.tagName === 'html')
    ?.childNodes?.find((node) => node.tagName === 'head');
  if (!head) return 0;
  const links = [];
  const walk = (node) => {
    if (
      node.tagName === 'link' &&
      attribute(node, 'rel').toLowerCase().split(/\s+/).includes('stylesheet')
    ) {
      links.push(node);
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
  let inlined = 0;
  for (const link of links) {
    const href = attribute(link, 'href');
    if (!href) continue;
    let url;
    try {
      url = new URL(href, PAGE_ORIGIN);
    } catch {
      continue;
    }
    if (url.origin !== PAGE_ORIGIN) continue;
    const appPath = toAppPath(url.href, base);
    if (!appPath?.startsWith('/snappy-assets/')) continue;
    const css = await fs.readFile(path.join(outputDir, appPath.slice(1)), 'utf8').catch(() => null);
    if (css === null) continue;
    const expanded = await expandLocalImports(css, url.href, outputDir, base);
    if (hasImportRule(expanded)) continue;
    const text = rewriteCssUrls(expanded, url.href, PAGE_ORIGIN);
    const cssText = minifyCssOptions ? minifyCss(text, minifyCssOptions) : text;
    const style = {
      nodeName: 'style',
      tagName: 'style',
      attrs: [{ name: 'data-snappy-inline', value: '' }],
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      childNodes: [],
      parentNode: head,
    };
    style.childNodes.push({ nodeName: '#text', value: cssText, parentNode: style });
    const parent = link.parentNode;
    const index = parent?.childNodes?.indexOf(link) ?? -1;
    if (index >= 0) {
      style.parentNode = parent;
      parent.childNodes.splice(index, 1, style);
    } else {
      head.childNodes.push(style);
    }
    inlined += 1;
  }
  return inlined;
}

/**
 * Inlines only the above-the-fold CSS and defers the rest, using beasties. It runs
 * on the serialised HTML in Node, reading stylesheets from the output directory.
 * beasties is an optional peer dependency because most projects never need it.
 * `preload` is passed through so a strict script-src can turn the swap handlers off.
 */
export async function inlineCriticalCss({
  html,
  outputDir,
  base,
  preload = 'media',
  cache = null,
}) {
  const key = `${path.resolve(outputDir)}|${base}|${preload}`;
  let state = cache?.get(key);
  if (!state) {
    state = {
      processor: createCriticalCssProcessor({ outputDir, base, preload }),
      tail: Promise.resolve(),
    };
    cache?.set(key, state);
  }
  // Beasties keeps per-instance selector state and is not safe for concurrent process
  // calls, so this queue serialises routes while sharing the instance.
  const run = state.tail.then(async () => {
    const beasties = await state.processor;
    return beasties.process(html);
  });
  state.tail = run.then(
    () => undefined,
    () => undefined,
  );
  try {
    return await run;
  } catch (error) {
    if (cache?.get(key) === state) cache.delete(key);
    throw error;
  }
}

// Expands @import rules that point at other local snappy-assets files.
async function expandLocalImports(css, cssUrl, outputDir, base, seen = new Set()) {
  const imports = [...css.matchAll(/@import\s+(?:url\(\s*)?(['"]?)([^'")]+)\1\s*\)?([^;]*);/gi)];
  if (imports.length === 0) return css;
  let output = '';
  let cursor = 0;
  for (const match of imports) {
    output += css.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    let url;
    try {
      url = new URL(match[2], cssUrl);
    } catch {
      output += match[0];
      continue;
    }
    const appPath = toAppPath(url.href, base);
    if (!appPath?.startsWith('/snappy-assets/') || seen.has(appPath)) {
      output += match[0];
      continue;
    }
    const nested = await fs
      .readFile(path.join(outputDir, appPath.slice(1)), 'utf8')
      .catch(() => null);
    if (nested === null) {
      output += match[0];
      continue;
    }
    seen.add(appPath);
    const expanded = await expandLocalImports(nested, url.href, outputDir, base, seen);
    const media = match[3].trim();
    output += media ? `@media ${media}{${expanded}}` : expanded;
  }
  return output + css.slice(cursor);
}

// Reads one parse5 attribute value.
function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

// Creates the Beasties processor once per output configuration. The selector cache is
// reused across routes; stylesheet text is still read per page by the library.
async function createCriticalCssProcessor({ outputDir, base, preload }) {
  let Beasties;
  try {
    ({ default: Beasties } = await import('beasties'));
  } catch {
    throw new Error(
      "inlineCss: 'critical' needs the optional beasties dependency. Install it with: npm install beasties",
    );
  }
  return new Beasties({
    path: outputDir,
    publicPath: base,
    logLevel: 'silent',
    preload,
    noscriptFallback: true,
  });
}
