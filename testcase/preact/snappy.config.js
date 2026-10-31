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
  transformHtml: guardApiContent,
  metadata: {
    siteUrl: 'https://aethercompute.space',
    siteName: 'Aether Compute',
    trailingSlash: 'always',
  },
  freezeTime: '2026-10-30T00:00:00Z',
  timezone: 'UTC',
  randomSeed: 42,
  // The shared renderer supplies the page as an HTML string, so the wrapper adopts the
  // container but replaces its prerendered body on boot. That is a re-render, not hydration.
  hydration: {
    allowRerender: ['/*'],
  },
  sitemap: true,
  preloadManifest: true,
};

export default config;
