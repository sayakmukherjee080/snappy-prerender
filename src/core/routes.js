/**
 * Canonicalises a route to an app-relative path without query, hash or trailing
 * slash. Dot segments are resolved so crawled links can never escape the output
 * directory through path traversal.
 */
export function normaliseRoute(input) {
  let route = String(input).trim();
  const hashIndex = route.indexOf('#');
  if (hashIndex !== -1) route = route.slice(0, hashIndex);
  const queryIndex = route.indexOf('?');
  if (queryIndex !== -1) route = route.slice(0, queryIndex);
  if (!route.startsWith('/')) route = `/${route}`;

  const segments = [];
  for (const segment of route.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

/**
 * Matches a route against one include/exclude pattern. Strings match exactly,
 * strings ending in `*` match by prefix, and RegExp patterns are tested directly.
 */
export function matchesPattern(route, pattern) {
  if (pattern instanceof RegExp) return pattern.test(route);
  if (pattern.endsWith('*')) return route.startsWith(pattern.slice(0, -1));
  return route === pattern;
}

// Reports whether any pattern in a list matches the route.
function matchesAny(route, patterns) {
  return patterns.some((pattern) => matchesPattern(route, pattern));
}
/**
 * Applies include/exclude filtering and de-duplication to a list of candidate
 * routes. Include only filters when the user supplied patterns beyond the default.
 */
export function filterRoutes(routes, { include, exclude }) {
  const seen = new Set();
  const kept = [];
  for (const candidate of routes) {
    const route = normaliseRoute(candidate);
    if (seen.has(route)) continue;
    if (include.length > 0 && !matchesAny(route, include)) continue;
    if (exclude.length > 0 && matchesAny(route, exclude)) continue;
    seen.add(route);
    kept.push(route);
  }
  return kept;
}

/**
 * Extracts the app-relative route from an absolute link found in the page. Returns
 * null for non-http links or links outside the configured base path.
 */
export function toAppRoute(href, base) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  let pathname = url.pathname;
  if (base !== '/') {
    const prefix = base.slice(0, -1);
    if (pathname === prefix) pathname = '/';
    else if (pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length);
    else return null;
  }
  return normaliseRoute(pathname);
}

/**
 * Builds the absolute URL the browser should visit for an app-relative route,
 * re-applying the configured base path.
 */
export function toServerUrl(route, base, origin) {
  const prefix = base === '/' ? '' : base.slice(0, -1);
  return `${origin}${prefix}${route}`;
}

/**
 * Reports whether a pattern can be requested as a literal route. Wildcard and
 * RegExp patterns only ever act as allowlist filters, never as crawl seeds.
 */
export function isConcreteRoute(pattern) {
  return typeof pattern === 'string' && !pattern.includes('*');
}

/**
 * Resolves the crawl roots. Concrete include entries are seeded directly; when the
 * include list only holds patterns, crawling starts from the root route. Excluded
 * routes are dropped here too, so a seed cannot bypass the exclude list.
 */
export function crawlRoots({ include, exclude = [] }) {
  const concrete = include.filter(isConcreteRoute);
  return filterRoutes(concrete.length > 0 ? concrete : ['/'], { include: [], exclude });
}

/**
 * Reports whether a route still needs visiting given the crawl depth limit.
 */
export function withinDepth(depth, maxDepth) {
  return maxDepth === null || depth <= maxDepth;
}
