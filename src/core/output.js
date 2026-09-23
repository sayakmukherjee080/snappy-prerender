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
