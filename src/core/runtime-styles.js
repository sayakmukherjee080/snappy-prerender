/**
 * Captures styles that exist only in the CSS object model. Runtimes that use
 * CSSStyleSheet.insertRule (emotion and styled-components in their production
 * "speedy" modes, JSS, and others) leave the style element empty in the DOM, so
 * serialising the page would drop every rule. This copies those rules into the
 * element text, and folds document-level constructable stylesheets into a style tag.
 * A no-op for ordinary style elements and for pages without runtime styles.
 */
export async function captureRuntimeStyles(page) {
  await page.evaluate(() => {
    // Reads the rules a style element holds in the CSSOM, tolerating odd sheets.
    const rulesOf = (sheet) => {
      try {
        return Array.from(sheet.cssRules ?? []);
      } catch {
        return [];
      }
    };

    for (const style of document.querySelectorAll('style')) {
      if (style.textContent.trim().length > 0) continue;
      if (!style.sheet) continue;
      const css = rulesOf(style.sheet)
        .map((rule) => rule.cssText)
        .join('\n');
      if (css.length > 0) style.textContent = css;
    }

    const adopted = Array.from(document.adoptedStyleSheets ?? []);
    if (adopted.length === 0) return;
    const css = adopted
      .flatMap((sheet) => rulesOf(sheet))
      .map((rule) => rule.cssText)
      .join('\n');
    if (css.trim().length === 0) return;

    const style = document.createElement('style');
    style.setAttribute('data-snappy-adopted', '');
    style.textContent = css;
    document.head.appendChild(style);
  });
}
