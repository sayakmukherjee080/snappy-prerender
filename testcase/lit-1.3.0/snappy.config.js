import { guardApiContent } from '../shared/guard-api-content.js';
import { getAllRoutePaths, routes } from '../shared/routes.js';

/**
 * Prerender settings for the Aether Compute site. Every published route in the shared
 * manifest is listed explicitly, plus the not-found route.
 */
const config = {
  sourceDir: 'dist',
  include: [...getAllRoutePaths(routes), '/404'],
  crawl: false,
  notFoundRoute: '/404',
  // lit-html 1.3 keeps its part map in a module-scoped WeakMap and leaves no DOM marker,
  // so verification needs the explicit framework when the hydration skip is removed.
  framework: 'lit',
  transformHtml: guardApiContent,
  metadata: {
    siteUrl: 'https://aethercompute.space',
    siteName: 'Aether Compute',
    trailingSlash: 'always',
  },
  freezeTime: '2026-10-30T00:00:00Z',
  timezone: 'UTC',
  randomSeed: 42,
  // This implementation is a prerender-only host wrapper; hydration verification is
  // covered by the React, Preact and Vue apps.
  hydration: {
    skip: ['/*'],
  },
  sitemap: true,
  preloadManifest: true,
};

export default config;
