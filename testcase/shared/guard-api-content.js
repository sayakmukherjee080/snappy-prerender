/**
 * Fails the build when an API route did not render a live index or article. The marker is
 * structural, so article text that happens to mention an API failure cannot trip the guard.
 * @param {string} html
 * @param {{ route?: string }} context
 * @returns {string}
 */
export function guardApiContent(html, { route } = {}) {
  if (!route) return html;
  const path = route.replace(/\/+$/, '') || '/';
  if (path !== '/api' && !path.startsWith('/api/')) return html;
  const marker = path === '/api' ? 'class="api-card"' : 'class="api-article"';
  if (!html.includes(marker)) {
    throw new Error(`Live API source failed for ${route}; refusing to write an error page`);
  }
  return html;
}
