import { hasImportRule, rewriteCssUrls } from './css-url.js';
import { minifyCss } from './minify.js';

/**
 * Inlines every same-origin stylesheet the page loaded, replacing the links with a
 * single style tag. Blob-backed stylesheets work too because the text is read from
 * the live page. Stylesheets that cannot be fetched, or that use @import, are left in
 * place. Relative url() values are rebased against each sheet before joining so fonts
 * and images keep working on nested routes.
 */
export async function inlineStylesheets({ page, minifyCssOptions }) {
  const collected = await page.evaluate(async () => {
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
      try {
        const response = await fetch(link.href);
        if (!response.ok) throw new Error(String(response.status));
        sheets.push({ css: await response.text(), href: link.href });
      } catch {
        skipped.push(link.href);
      }
    }
    return { sheets, skipped };
  });

  const inlineable = [];
  const skipped = [...collected.skipped];
  for (const sheet of collected.sheets) {
    if (hasImportRule(sheet.css)) skipped.push(sheet.href);
    else inlineable.push(sheet);
  }
  if (inlineable.length === 0) return { skipped };

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
  return { skipped };
}

/**
 * Inlines only the above-the-fold CSS and defers the rest, using beasties. It runs
 * on the serialised HTML in Node, reading stylesheets from the output directory.
 * beasties is an optional peer dependency because most projects never need it.
 * `preload` is passed through so a strict script-src can turn the swap handlers off.
 */
export async function inlineCriticalCss({ html, outputDir, base, preload = 'media' }) {
  let Beasties;
  try {
    ({ default: Beasties } = await import('beasties'));
  } catch {
    throw new Error(
      "inlineCss: 'critical' needs the optional beasties dependency. Install it with: npm install beasties",
    );
  }
  const beasties = new Beasties({
    path: outputDir,
    publicPath: base,
    logLevel: 'silent',
    preload,
    noscriptFallback: true,
  });
  return beasties.process(html);
}
