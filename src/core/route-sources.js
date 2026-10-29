import fs from 'node:fs/promises';
import path from 'node:path';
import { isSafeRoute, normaliseRoute, toAppRoute } from './routes.js';
import { mapLimit } from './scheduler.js';

const MAX_SOURCE_ROUTES = 100000;
const FETCH_TIMEOUT = 10000;
const SITEMAP_FETCH_CONCURRENCY = 4;
const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Loads concrete route seeds from a text/JSON file and/or a sitemap. These are seeds,
 * not a router: directory-style app paths still have to be handled by the app.
 */
export async function loadRouteSeeds(config) {
  const routes = [];
  const sources = [];
  if (config.routesFile) {
    const read = await readRouteFile(config.routesFile, config);
    routes.push(...read.routes);
    sources.push({
      source: config.routesFile,
      type: 'file',
      routes: read.routes.length,
      skipped: read.skipped,
    });
  }
  if (config.routesFromSitemap) {
    const read = await readRouteSitemap(config.routesFromSitemap, config);
    routes.push(...read.routes);
    sources.push({
      source: config.routesFromSitemap,
      type: 'sitemap',
      routes: read.routes.length,
      skipped: read.skipped,
    });
  }
  const unique = [...new Set(routes)];
  if (unique.length > MAX_SOURCE_ROUTES) {
    throw new Error(`route sources produced more than ${MAX_SOURCE_ROUTES} routes`);
  }
  return { routes: unique, sources };
}

// Reads a text or JSON route list. Text accepts one route per line and # comments.
async function readRouteFile(file, config) {
  const contents = await fs.readFile(path.resolve(file), 'utf8');
  let values;
  const trimmed = contents.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`routesFile is not valid JSON: ${error.message}`);
    }
    values = Array.isArray(parsed) ? parsed : parsed?.routes;
    if (!Array.isArray(values)) {
      throw new Error('routesFile JSON must be an array or an object with a routes array');
    }
  } else {
    values = trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter((line) => line.length > 0);
  }
  return normaliseAndFilter(values, 'routesFile', config);
}

// Reads a sitemap, following a sitemap index one level deep.
async function readRouteSitemap(location, config) {
  const pageUrls = [];
  await readSitemapLevel(location, pageUrls, 0);
  const sourceOrigin = /^https?:\/\//i.test(location) ? new URL(location).origin : null;
  return normaliseAndFilter(pageUrls, 'routesFromSitemap', config, sourceOrigin, true);
}

async function readSitemapLevel(location, pageUrls, depth) {
  if (depth > 1) return;
  const { text, base } = await readSource(location);
  if (!/<(?:urlset|sitemapindex)\b/i.test(text)) {
    throw new Error(`${location} is not a sitemap: no urlset or sitemapindex element found`);
  }
  if (/<sitemapindex\b/i.test(text)) {
    const children = extractLocs(text);
    const { results, errors } = await mapLimit(
      children,
      SITEMAP_FETCH_CONCURRENCY,
      async (child) => {
        const routes = [];
        await readSitemapLevel(resolveChild(child, base), routes, depth + 1);
        return routes;
      },
    );
    if (errors.length > 0) throw errors[0].error;
    for (const routes of results) pageUrls.push(...routes);
    return;
  }
  pageUrls.push(...extractLocs(text));
}

// Reads a local path or an http(s) sitemap.
async function readSource(location) {
  if (/^https?:\/\//i.test(location)) {
    const response = await fetch(location, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { accept: 'application/xml,text/xml,*/*' },
    });
    if (!response.ok) throw new Error(`sitemap ${location} answered HTTP ${response.status}`);
    return { text: await response.text(), base: location };
  }
  const file = path.resolve(location);
  return { text: await fs.readFile(file, 'utf8'), base: file };
}

// Resolves a child sitemap location relative to its parent.
function resolveChild(child, base) {
  if (/^https?:\/\//i.test(child)) return child;
  if (/^https?:\/\//i.test(base)) return new URL(child, base).href;
  return path.resolve(path.dirname(base), child);
}

// Extracts and unescapes every <loc> value.
function extractLocs(xml) {
  const values = [];
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    values.push(unescapeXml(match[1].trim()));
  }
  return values;
}

function unescapeXml(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => XML_ENTITIES[name]);
}

// Converts source values to app-relative routes and drops unsafe or off-origin entries.
function normaliseAndFilter(
  values,
  source,
  config = null,
  sourceOrigin = null,
  enforceOrigin = false,
) {
  const siteOrigin = config?.metadata?.siteUrl ? new URL(config.metadata.siteUrl).origin : null;
  const referenceOrigin = siteOrigin ?? sourceOrigin;
  const base = config?.base ?? '/';
  const routes = [];
  const seen = new Set();
  let skipped = 0;
  for (const value of values) {
    if (typeof value !== 'string') {
      skipped += 1;
      continue;
    }
    const absolute = parseAbsolute(value, referenceOrigin);
    if (/^https?:\/\//i.test(value) && !absolute) {
      skipped += 1;
      continue;
    }
    let route;
    if (absolute) {
      if (!referenceOrigin) {
        if (enforceOrigin) {
          skipped += 1;
          continue;
        }
      } else if (absolute.origin !== referenceOrigin) {
        skipped += 1;
        continue;
      }
      route = toAppRoute(absolute.href, base);
    } else if (value.startsWith('//')) {
      // A protocol-relative URL needs an origin to resolve against; without one it is
      // not safe to guess which host it belongs to.
      skipped += 1;
      continue;
    } else {
      route = normaliseRoute(stripBase(value, base));
    }
    if (!route || !isSafeRoute(route) || seen.has(route)) {
      skipped += 1;
      continue;
    }
    seen.add(route);
    routes.push(route);
  }
  if (routes.length === 0 && values.length > 0) {
    throw new Error(`${source} did not contain any usable routes`);
  }
  return { routes, skipped };
}

// Resolves an absolute or protocol-relative URL, returning null for paths.
function parseAbsolute(value, referenceOrigin) {
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  }
  if (value.startsWith('//') && referenceOrigin) {
    try {
      return new URL(value, referenceOrigin);
    } catch {
      return null;
    }
  }
  return null;
}

// Removes the public base prefix from a root-relative path, leaving app-relative paths
// alone so a sitemap can list either form.
function stripBase(value, base) {
  if (base === '/') return value;
  const prefix = base.slice(0, -1);
  if (value === prefix) return '/';
  if (value.startsWith(`${prefix}/`)) return value.slice(prefix.length);
  return value;
}
