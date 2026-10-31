import { lazy } from 'react';

const loadedPages = new Map();
const lazyPages = new Map();

/**
 * Registers a page module that has already been imported, so the first render can use
 * it directly instead of suspending inside a lazy boundary.
 * @param {string} path
 * @param {Function} component
 */
export function primePage(path, component) {
  loadedPages.set(path, component);
}

/**
 * Reports whether a route's page module is already loaded.
 * @param {string} path
 * @returns {boolean}
 */
export function isPageLoaded(path) {
  return loadedPages.has(path);
}

/**
 * Returns the component for a route, using the loaded module when one exists and a
 * cached lazy wrapper otherwise.
 * @param {{ path: string, load: () => Promise<{ default: Function }> }} route
 * @returns {Function}
 */
export function getPage(route) {
  if (loadedPages.has(route.path)) return loadedPages.get(route.path);
  if (!lazyPages.has(route.path)) lazyPages.set(route.path, lazy(route.load));
  return lazyPages.get(route.path);
}

/**
 * Imports a route's page module and caches its component for a synchronous render.
 * @param {{ path: string, load: () => Promise<{ default: Function }> }} route
 * @returns {Promise<Function>}
 */
export async function preloadPage(route) {
  if (loadedPages.has(route.path)) return loadedPages.get(route.path);
  const module = await route.load();
  primePage(route.path, module.default);
  return module.default;
}
