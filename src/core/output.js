import fs from 'node:fs/promises';
import path from 'node:path';
import { normaliseRoute } from './routes.js';

/**
 * Maps an app-relative route to its output file. The configured not-found route is
 * always emitted as 404.html so hosts with static error pages pick it up.
 */
export function routeToFile(route, { flatOutput = false, notFoundRoute = null } = {}) {
  const normalised = normaliseRoute(route);
  if (notFoundRoute && normalised === normaliseRoute(notFoundRoute)) return '404.html';
  if (normalised === '/') return 'index.html';
  const relative = normalised.slice(1);
  return flatOutput ? `${relative}.html` : path.posix.join(relative, 'index.html');
}

/**
 * Maps a route to its screenshot file. The root route becomes index.png, other
 * routes keep their path with the extension swapped.
 */
export function routeToScreenshotFile(route, { saveAs = 'png' } = {}) {
  const normalised = normaliseRoute(route);
  const extension = saveAs === 'jpeg' ? 'jpeg' : 'png';
  if (normalised === '/') return `index.${extension}`;
  return `${normalised.slice(1)}.${extension}`;
}

/**
 * Finds routes that would write the same output file. Two routes can collide, most
 * obviously with flatOutput where both "/" and "/index" map to index.html. Callers
 * use this to refuse the ambiguous writes instead of letting one overwrite the other.
 */
export function findOutputCollisions(routes, config) {
  const byFile = new Map();
  const saveAs = config.saveAs ?? 'html';
  for (const route of routes) {
    const file =
      saveAs === 'html' ? routeToFile(route, config) : routeToScreenshotFile(route, config);
    const existing = byFile.get(file);
    if (existing) existing.push(route);
    else byFile.set(file, [route]);
  }
  return new Map([...byFile].filter(([, list]) => list.length > 1));
}

/**
 * Writes one rendered route into the output directory. Identical existing files are
 * left untouched, which keeps rebuilds and CI caches stable.
 */
export async function writeRouteHtml({ dir, route, html, config }) {
  const file = routeToFile(route, config);
  const bytes = Buffer.byteLength(html);

  if (config.dryRun) return { route, file, status: 'dry-run', bytes };

  const target = path.join(dir, file);
  const existing = await fs.readFile(target, 'utf8').catch(() => null);
  if (existing === html) return { route, file, status: 'unchanged', bytes };

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, html, 'utf8');
  return { route, file, status: 'written', bytes };
}
