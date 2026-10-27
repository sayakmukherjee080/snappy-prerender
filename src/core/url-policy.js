import { normaliseRoute } from './routes.js';

/**
 * Builds the public path for a route using the same policy for canonical, social and
 * sitemap URLs. Directory output keeps the trailing slash it is served with; flat
 * output stays extensionless so `/about` remains the URL even though the file is
 * `about.html`. An explicit trailingSlash convention always wins.
 */
export function pagePath(route, { flatOutput = false, trailingSlash = 'preserve' } = {}) {
  const normalised = normaliseRoute(route);
  if (normalised === '/') return '/';
  if (trailingSlash === 'always') return `${normalised}/`;
  if (trailingSlash === 'never') return normalised;
  return flatOutput ? normalised : `${normalised}/`;
}

/**
 * Applies a trailing slash convention to an absolute URL, leaving the root and asset
 * URLs alone. Used for an explicit canonical that is already a full URL.
 */
export function withTrailingSlash(url, convention) {
  if (convention !== 'always' && convention !== 'never') return url;
  const [path, query] = url.split('?');
  const isRoot = /^https?:\/\/[^/]+\/?$/i.test(path);
  if (convention === 'always') {
    const next = path.endsWith('/') ? path : `${path}/`;
    return query ? `${next}?${query}` : next;
  }
  if (isRoot) return query ? `${path.replace(/\/$/, '/')}?${query}` : path.replace(/\/?$/, '/');
  const next = path.replace(/\/+$/, '');
  return query ? `${next}?${query}` : next;
}
