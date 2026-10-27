import { normaliseRoute, toPublicPath } from './routes.js';
import { pagePath } from './url-policy.js';

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const SITEMAP_MAX_URLS = 50000;

/**
 * Builds the sitemap for the routes a run wrote. Locs use the same page path policy as
 * canonical links, so a directory route keeps its slash, a flat route stays
 * extensionless, and a noindex page is never listed. More than maxUrls entries are
 * split into numbered sitemaps behind a sitemap index.
 */
export function buildSitemap({ files, config, maxUrls = SITEMAP_MAX_URLS }) {
  const siteUrl = config.metadata?.siteUrl?.replace(/\/$/, '');
  if (!siteUrl) return null;
  const notFound = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;

  const locs = new Set();
  for (const file of files) {
    if (!file.file.endsWith('.html') || file.noindex) continue;
    if (file.route && notFound && normaliseRoute(file.route) === notFound) continue;
    const path = file.route
      ? pagePath(file.route, {
          flatOutput: config.flatOutput,
          trailingSlash: config.metadata?.trailingSlash,
        })
      : publicPath(file.file);
    locs.add(`${siteUrl}${toPublicPath(path, config.base)}`);
  }
  if (locs.size === 0) return null;

  const sorted = [...locs].sort();
  const chunks = [];
  for (let index = 0; index < sorted.length; index += maxUrls) {
    chunks.push(sorted.slice(index, index + maxUrls));
  }

  if (chunks.length === 1) {
    return { files: [{ name: 'sitemap.xml', contents: urlSet(chunks[0]) }], routes: sorted.length };
  }

  const entries = chunks.map((chunk, index) => {
    const name = `sitemap-${index + 1}.xml`;
    const loc = `${siteUrl}${toPublicPath(`/${name}`, config.base)}`;
    return { name, contents: urlSet(chunk), loc };
  });
  return {
    files: [
      { name: 'sitemap.xml', contents: sitemapIndex(entries) },
      ...entries.map(({ name, contents }) => ({ name, contents })),
    ],
    routes: sorted.length,
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

// Builds one urlset document.
function urlSet(locs) {
  const urls = locs.map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Builds the sitemap index that points at the numbered sitemaps.
function sitemapIndex(entries) {
  const sitemaps = entries
    .map((entry) => `  <sitemap>\n    <loc>${escapeXml(entry.loc)}</loc>\n  </sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps}\n</sitemapindex>\n`;
}

// Escapes the characters that would break a sitemap element.
function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}
