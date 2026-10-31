import { fileURLToPath } from 'node:url';
import { getAllRoutePaths, routes } from '../shared/routes.js';

const labPaths = getAllRoutePaths(routes).filter(
  (path) => path === '/lab' || path.startsWith('/lab/'),
);

/**
 * Test-only settings for the unlisted lab. A storage-state cookie unlocks the demo gate
 * inside the render and verification contexts.
 */
const config = {
  sourceDir: 'dist',
  include: labPaths,
  crawl: false,
  routeOverrides: [
    {
      match: '/lab*',
      storageState: fileURLToPath(new URL('./snappy.lab-state.json', import.meta.url)),
    },
  ],
  metadata: {
    siteUrl: 'https://aethercompute.space',
    siteName: 'Aether Compute',
    trailingSlash: 'always',
  },
  freezeTime: '2026-11-01T00:00:00Z',
  timezone: 'Europe/Paris',
  randomSeed: 42,
  locales: {
    mode: 'single',
    active: 'fr',
    default: 'en',
    xDefault: 'en',
    hreflang: true,
    list: [
      { code: 'en', url: 'https://aethercompute.space', htmlLang: 'en', ogLocale: 'en_US' },
      {
        code: 'fr',
        url: 'https://fr.aethercompute.space',
        htmlLang: 'fr',
        ogLocale: 'fr_FR',
        locale: 'fr',
        timezone: 'Europe/Paris',
      },
    ],
  },
  seoLocale: {
    code: 'fr',
    source: 'localStorage',
    localStorageKey: 'locale',
    inject: true,
    overwrite: true,
    forceHtmlLang: true,
    routes: ['/lab/head-parity'],
  },
  // The shared renderer supplies the page as an HTML string, so the wrapper adopts the
  // container but replaces its prerendered body on boot. That is a re-render, not hydration.
  hydration: {
    allowRerender: ['/*'],
  },
  sitemap: false,
  preloadManifest: false,
  audit: false,
};

export default config;
