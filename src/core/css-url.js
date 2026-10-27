const URL_TOKEN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const NON_LOCAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Rebases the relative url() values in a stylesheet against the stylesheet's own URL.
 * Moving a sheet from /assets/app.css into a <style> element would otherwise resolve
 * its fonts and images against the page URL, which differs on nested routes. Local
 * URLs become root-relative so they work from any page depth.
 */
export function rewriteCssUrls(css, stylesheetUrl, pageOrigin) {
  return css.replace(URL_TOKEN, (match, quote, value) => {
    const target = value.trim();
    if (target.length === 0 || NON_LOCAL.test(target)) return match;
    let resolved;
    try {
      resolved = new URL(target, stylesheetUrl);
    } catch {
      return match;
    }
    const next =
      resolved.origin === pageOrigin
        ? `${resolved.pathname}${resolved.search}${resolved.hash}`
        : resolved.href;
    return `url(${quote}${next}${quote})`;
  });
}

/**
 * Reports whether a stylesheet uses @import. Inlining cannot preserve the rule's
 * position in the cascade, so the caller leaves that sheet as a link instead.
 */
export function hasImportRule(css) {
  return /@import\b/i.test(css);
}
