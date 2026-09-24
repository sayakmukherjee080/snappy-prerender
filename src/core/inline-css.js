import { minifyCss } from './minify.js';

/**
 * Inlines every same-origin stylesheet the page loaded, replacing the links with a
 * single style tag. Blob-backed stylesheets work too because the text is read from
 * the live page. Stylesheets that cannot be fetched are left in place.
 */
export async function inlineStylesheets({ page, minifyCssOptions }) {
  const collected = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const parts = [];
    const skipped = [];
    for (const link of links) {
      try {
        const response = await fetch(link.href);
        if (!response.ok) throw new Error(String(response.status));
        parts.push(await response.text());
        link.remove();
      } catch {
        skipped.push(link.href);
      }
    }
    return { css: parts.join('\n'), skipped };
  });

  if (collected.css.trim().length === 0) return { skipped: collected.skipped };
  const css = minifyCssOptions ? minifyCss(collected.css, minifyCssOptions) : collected.css;
  await page.evaluate((text) => {
    const style = document.createElement('style');
    style.textContent = text;
    document.head.appendChild(style);
  }, css);
  return { skipped: collected.skipped };
}

/**
 * Inlines only the above-the-fold CSS and defers the rest, using beasties. It runs
 * on the serialised HTML in Node, reading stylesheets from the output directory.
 * beasties is an optional peer dependency because most projects never need it.
 */
export async function inlineCriticalCss({ html, outputDir, base }) {
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
    preload: 'media',
    noscriptFallback: true,
  });
  return beasties.process(html);
}
