import { matchPath } from './router.js';

/**
 * Builds the palette entries from the route manifest.
 * @param {Array<object>} manifest
 * @param {{ hiddenUnlocked?: boolean, showHidden?: boolean }} options
 * @returns {Array<{ path: string, title: string, group: string, hidden: boolean }>}
 */
export function buildPaletteItems(manifest, options = {}) {
  const items = [];
  for (const route of manifest) {
    for (const path of route.staticPaths ?? [route.path]) {
      if (route.hidden && !(options.hiddenUnlocked && options.showHidden)) continue;
      const params = matchPath(route.path, path) ?? {};
      const meta = route.meta?.(params) ?? {};
      items.push({
        path,
        title: meta.title ?? path,
        group: route.group ?? 'page',
        hidden: Boolean(route.hidden),
      });
    }
  }
  return items;
}
