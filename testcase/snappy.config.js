import { getAllRoutePaths } from './src/router/match.js';
import { routes } from './src/routes/index.js';

const API_SOURCE_ERROR = 'The source is not responding';
const API_MISSING_ARTICLE = 'That article is not in the feed.';

/**
 * Fails the build instead of writing an API route that shipped the source-error state. The
 * live source is allowed to change between builds, but a production build should not silently
 * publish a noindex error page in place of an article.
 * @param {string} html
 * @param {{ route?: string }} context
 * @returns {string}
 */
function guardApiContent(html, { route } = {}) {
  if (!route || (route !== '/api' && !route.startsWith('/api/'))) return html;
  if (html.includes(API_SOURCE_ERROR) || html.includes(API_MISSING_ARTICLE)) {
    throw new Error(`Live API source failed for ${route}; refusing to write an error page`);
  }
  return html;
}

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
