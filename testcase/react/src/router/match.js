import { normalizePath } from './store.js';

/**
 * Matches a pathname against a pattern containing static segments, `:params`, or a final `*`.
 * @param {string} pattern
 * @param {string} pathname
 * @returns {Record<string, string> | null}
 */
export function matchPath(pattern, pathname) {
  if (pattern === '*') return {};

  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = normalizePath(pathname).split('/').filter(Boolean);
  const params = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const segment = patternSegments[index];

    if (segment === '*') {
      params['*'] = pathSegments.slice(index).join('/');
      return params;
    }

    if (segment.startsWith(':')) {
      if (pathSegments[index] === undefined) return null;
      params[segment.slice(1)] = decodeURIComponent(pathSegments[index]);
      continue;
    }

    if (segment !== pathSegments[index]) return null;
  }

  return pathSegments.length === patternSegments.length ? params : null;
}

/**
 * Scores a matched route so static paths win over dynamic paths and catch-alls.
 * @param {string} pattern
 * @param {string} pathname
 * @returns {number}
 */
function scorePattern(pattern, pathname) {
  if (pattern === '*') return -1000;

  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = normalizePath(pathname).split('/').filter(Boolean);
  let score = 0;

  for (const segment of patternSegments) {
    if (segment === '*') score -= 100;
    else if (segment.startsWith(':')) score -= 1;
    else score += 10;
  }

  return score - Math.abs(patternSegments.length - pathSegments.length);
}

/**
 * Finds the most specific route matching a pathname.
 * @param {Array<{ path: string }>} routes
 * @param {string} pathname
 * @returns {{ route: object, params: Record<string, string>, score: number } | null}
 */
export function matchRoute(routes, pathname) {
  let bestMatch = null;

  for (const route of routes) {
    const params = matchPath(route.path, pathname);
    if (!params) continue;

    const score = scorePattern(route.path, pathname);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { route, params, score };
    }
  }

  return bestMatch;
}

/**
 * Expands a route record into every URL it publishes.
 * @param {{ path: string, staticPaths?: string[] }} route
 * @returns {string[]}
 */
export function getRoutePaths(route) {
  return route.staticPaths ?? [route.path];
}

/**
 * Flattens all published URLs from a route manifest.
 * @param {Array<{ path: string, staticPaths?: string[] }>} routes
 * @returns {string[]}
 */
export function getAllRoutePaths(routes) {
  return routes.flatMap(getRoutePaths);
}
