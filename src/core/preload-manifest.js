import path from 'node:path';
import { toPublicPath } from './routes.js';

/**
 * Builds the preload manifest: for every route, the same-origin scripts and
 * stylesheets it loaded, rendered as a Link header value. This replaces react-snap's
 * http2PushManifest because browsers removed HTTP/2 push (Chrome in v106); hosts can
 * still use these values for Early Hints or Link response headers. Hints and route keys
 * both carry the base path so they match the URLs a host actually sees.
 */
export function buildPreloadManifest(entries, { ignoreForPreload = [], base = '/' } = {}) {
  const ignored = new Set(ignoreForPreload);
  const manifest = [];
  for (const entry of entries) {
    const hints = [];
    for (const asset of [...entry.scripts, ...entry.styles]) {
      if (ignored.has(path.posix.basename(asset))) continue;
      const as = entry.scripts.includes(asset) ? 'script' : 'style';
      hints.push(`<${toPublicPath(asset, base)}>;rel=preload;as=${as}`);
    }
    if (hints.length === 0) continue;
    manifest.push({
      source: toPublicPath(entry.route, base),
      headers: [{ key: 'Link', value: hints.join(',') }],
    });
  }
  return manifest;
}
