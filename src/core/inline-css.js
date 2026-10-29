import path from 'node:path';
import { hasImportRule, rewriteCssUrls } from './css-url.js';
import { minifyCss } from './minify.js';

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
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
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
