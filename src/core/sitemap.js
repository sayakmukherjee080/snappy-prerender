import { normaliseRoute, toPublicPath } from './routes.js';

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/**
 * Builds the sitemap for the routes a run wrote. Locs are derived from the output file
 * names, so a directory route becomes /about/ and a flat one becomes /about.html, then
 * prefixed with the public base path. Returns null when there is no public site URL or
 * nothing to list, so callers can skip the write entirely.
 */
export function buildSitemap({ files, config, generatedAt = new Date() }) {
  const siteUrl = config.metadata?.siteUrl?.replace(/\/$/, '');
  if (!siteUrl) return null;
  const notFound = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;

  const locs = new Set();
  for (const file of files) {
    if (!file.file.endsWith('.html')) continue;
    if (file.route && notFound && normaliseRoute(file.route) === notFound) continue;
    locs.add(`${siteUrl}${toPublicPath(publicPath(file.file), config.base)}`);
  }
  if (locs.size === 0) return null;

  const lastmod = generatedAt.toISOString().slice(0, 10);
  const urls = [...locs]
    .sort()
    .map(
      (loc) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    )
    .join('\n');
  return {
    contents: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    routes: locs.size,
  };
}

/**
 * Maps an output file to the path a host serves it at: index.html is the root,
 * about/index.html is /about/, and anything else keeps its name.
 */
export function publicPath(file) {
  const normalised = String(file).replaceAll('\\', '/');
  if (normalised === 'index.html') return '/';
  if (normalised.endsWith('/index.html')) return `/${normalised.slice(0, -'index.html'.length)}`;
  return `/${normalised}`;
}

/**
 * Appends the sitemap location to a robots.txt that exists but does not mention it yet,
 * leaving a file that already points somewhere alone.
 */
export function withSitemapDirective(robots, sitemapUrl) {
  if (/^\s*sitemap:/im.test(robots)) return null;
  const separator = robots.endsWith('\n') ? '' : '\n';
  return `${robots}${separator}Sitemap: ${sitemapUrl}\n`;
}

// Escapes the characters that would break a sitemap element.
function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}
