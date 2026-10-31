import { guardApiContent } from '../shared/guard-api-content.js';
import { getAllRoutePaths } from './src/router/match.js';
import { routes } from './src/routes/index.js';

/**
 * Prerender settings for the Aether Compute site. Every published route in the manifest
 * is listed explicitly, plus the not-found route, so a run covers exactly the pages the
 * site publishes and the public address feeds canonical, social and sitemap URLs.
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
  // The API section is live by design: it fetches the Spaceflight News API in the browser and
  // can return a different article set on the verification pass. Allow those routes to
  // re-render while every static page stays strict.
  freezeTime: '2026-10-30T00:00:00Z',
  timezone: 'UTC',
  randomSeed: 42,
  hydration: {
    allowRerender: ['/api', '/api/*'],
  },
  sitemap: true,
  preloadManifest: true,
  // CSP hash mode is intentionally off: the demo loads Google Fonts and sets inline
  // width styles, while the package's hash policy allows 'self' only. Enable it after
  // self-hosting the fonts and moving the generated widths into classes.
};

export default config;
