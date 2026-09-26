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
  if (config.dryRun) {
    return { route, file, status: 'dry-run', bytes: Buffer.byteLength(html) };
  }
  const written = await writeFileIfChanged({ dir, file, contents: html });
  return { route, file, status: written.status, bytes: written.bytes };
}

/**
 * Writes a generated file, leaving an identical one untouched. Page files and the state
 * files routes reference both go through here so a rebuild only touches what changed.
 */
export async function writeFileIfChanged({ dir, file, contents }) {
  const bytes = Buffer.byteLength(contents);
  const target = path.join(dir, file);
  const existing = await fs.readFile(target, 'utf8').catch(() => null);
  if (existing === contents) return { file, status: 'unchanged', bytes };

  await fs.mkdir(path.dirname(target), { recursive: true });
  // Written through a temporary file and renamed, so an interrupted run cannot leave a
  // half-written file behind for a host to serve.
  const temporary = `${target}.snappy-tmp`;
  try {
    await fs.writeFile(temporary, contents, 'utf8');
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return { file, status: 'written', bytes };
}
