import path from 'node:path';
import { parse } from 'parse5';
import { toAppPath } from './resources.js';
import { normaliseRoute, toPublicPath } from './routes.js';
import { pagePath } from './url-policy.js';

/** A synthetic origin used only to resolve hrefs while reading the generated HTML. */
const PAGE_ORIGIN = 'http://snappy.local';

/**
 * Reads the scripts and stylesheets the final HTML actually references. Using the
 * output rather than the render-time resource list keeps the manifest correct after
 * inline CSS, tag surgery, or a failed write.
 */
export function collectPageResources(html, { base = '/', route = '/' } = {}) {
  const document = parse(html);
  const scripts = [];
  const styles = [];
  const pageUrl = new URL(toPublicPath(route, base), PAGE_ORIGIN);
  const add = (node, attribute, target) => {
    const raw = node.attrs?.find((entry) => entry.name === attribute)?.value;
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return;
    let url;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      return;
    }
    if (url.origin !== PAGE_ORIGIN) return;
    const appPath = toAppPath(url.href, base);
    if (appPath) target.push(appPath);
  };
  const walk = (node) => {
    if (node.tagName === 'template') return;
    if (node.tagName === 'script') add(node, 'src', scripts);
    if (node.tagName === 'link') {
      const rel = node.attrs?.find((entry) => entry.name === 'rel')?.value ?? '';
      if (rel.split(/\s+/).includes('stylesheet')) add(node, 'href', styles);
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
  return { scripts: [...new Set(scripts)], styles: [...new Set(styles)] };
}

/**
 * Builds the preload manifest: for every route, the same-origin scripts and
 * stylesheets the final page references, rendered as a Link header value. This
 * replaces react-snap's http2PushManifest because browsers removed HTTP/2 push
 * (Chrome in v106); hosts can still use these values for Early Hints or Link response
 * headers. Hints and route keys both carry the base path so they match the URLs a host
 * actually sees.
 */
export function buildPreloadManifest(
  entries,
  {
    ignoreForPreload = [],
    base = '/',
    flatOutput = false,
    trailingSlash = 'preserve',
    notFoundRoute = null,
  } = {},
) {
  const ignored = new Set(ignoreForPreload);
  const notFound = notFoundRoute ? normaliseRoute(notFoundRoute) : null;
  const manifest = [];
  for (const entry of entries) {
    if (notFound && normaliseRoute(entry.route) === notFound) continue;
    const hints = [];
    for (const asset of [...entry.scripts, ...entry.styles]) {
      if (ignored.has(path.posix.basename(asset))) continue;
      const as = entry.scripts.includes(asset) ? 'script' : 'style';
      hints.push(`<${toPublicPath(asset, base)}>;rel=preload;as=${as}`);
    }
    if (hints.length === 0) continue;
    manifest.push({
      source: toPublicPath(pagePath(entry.route, { flatOutput, trailingSlash }), base),
      headers: [{ key: 'Link', value: hints.join(',') }],
    });
  }
  return manifest;
}
