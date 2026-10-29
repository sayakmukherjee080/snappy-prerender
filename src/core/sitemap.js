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

  const entries = [];
  for (const file of files) {
    if (!file.file.endsWith('.html') || file.noindex) continue;
    if (file.route && notFound && normaliseRoute(file.route) === notFound) continue;
    const path = file.route
      ? pagePath(file.route, {
          flatOutput: config.flatOutput,
          trailingSlash: config.metadata?.trailingSlash,
        })
      : publicPath(file.file);
    entries.push({
      loc: `${siteUrl}${toPublicPath(path, config.base)}`,
      alternates: normaliseAlternates(file.alternates ?? [], siteUrl, config.base),
      images: config.imageSitemap ? normaliseImages(file.images ?? [], siteUrl, config.base) : [],
    });
  }
  if (entries.length === 0) return null;

  entries.sort((a, b) => a.loc.localeCompare(b.loc));
  const chunks = [];
  for (let index = 0; index < entries.length; index += maxUrls) {
    chunks.push(entries.slice(index, index + maxUrls));
  }

  if (chunks.length === 1) {
    return {
      files: [{ name: 'sitemap.xml', contents: urlSet(chunks[0]) }],
      routes: entries.length,
      locs: entries.map((entry) => entry.loc),
    };
  }

  const chunksWithNames = chunks.map((chunk, index) => {
    const name = `sitemap-${index + 1}.xml`;
    const loc = `${siteUrl}${toPublicPath(`/${name}`, config.base)}`;
    return { name, contents: urlSet(chunk), loc };
  });
  return {
    files: [
      { name: 'sitemap.xml', contents: sitemapIndex(chunksWithNames) },
      ...chunksWithNames.map(({ name, contents }) => ({ name, contents })),
    ],
    routes: entries.length,
    locs: entries.map((entry) => entry.loc),
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
function urlSet(entries) {
  const hasAlternates = entries.some((entry) => entry.alternates.length > 0);
  const hasImages = entries.some((entry) => entry.images.length > 0);
  const namespaces = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    hasAlternates ? 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' : null,
    hasImages ? 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const urls = entries
    .map((entry) => {
      const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      for (const alternate of entry.alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`,
        );
      }
      for (const image of entry.images) {
        lines.push(
          `    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>`,
        );
      }
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${namespaces}>\n${urls}\n</urlset>\n`;
}

// Resolves hreflang links and removes duplicates.
function normaliseAlternates(alternates, siteUrl, base) {
  const seen = new Set();
  const result = [];
  for (const alternate of alternates) {
    const href = absoluteSitemapUrl(alternate.href, siteUrl, base);
    if (!href) continue;
    const key = `${alternate.hreflang}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ hreflang: alternate.hreflang, href });
  }
  return result;
}

// Resolves image URLs to absolute same-origin URLs.
function normaliseImages(images, siteUrl, base) {
  const seen = new Set();
  const result = [];
  for (const image of images) {
    const absolute = absoluteSitemapUrl(image, siteUrl, base);
    if (!absolute || new URL(absolute).origin !== new URL(siteUrl).origin) continue;
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    result.push(absolute);
  }
  return result;
}

// Resolves a site-relative path against the public base, leaving absolute URLs alone.
function absoluteSitemapUrl(value, siteUrl, base) {
  if (!value) return null;
  const raw = String(value);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const basePrefix = base === '/' ? '' : base.slice(0, -1);
  if (basePrefix && (raw === basePrefix || raw.startsWith(`${basePrefix}/`))) {
    return `${siteUrl}${raw}`;
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${siteUrl}${basePrefix}${path}`;
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
