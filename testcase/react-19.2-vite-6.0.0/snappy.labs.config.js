import { fileURLToPath } from 'node:url';
import { getAllRoutePaths } from './src/router/match.js';
import { routes } from './src/routes/index.js';

const labPaths = getAllRoutePaths(routes).filter(
  (path) => path === '/lab' || path.startsWith('/lab/'),
);

/**
 * Test-only settings for the unlisted lab. A storage-state cookie unlocks the demo gate
 * inside the render and verification contexts, so every lab component is exercised
 * without changing the gated output the public config publishes. The matrix, SEO locale,
 * clock, and hydration policy here exercise the package's 2.8 controls against real pages.
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
  hydration: {
    allowRerender: ['/lab/suspense-resource'],
  },
  sitemap: false,
  preloadManifest: false,
  audit: false,
};

export default config;
