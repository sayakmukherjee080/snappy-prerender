import testcaseConfig from '../testcase/react/snappy.config.js';

/**
 * Prerender configuration for the hosted after build. It runs the React testcase from
 * testcase/react so the demo verifies hydration and emits real route metadata, sitemap and
 * llms.txt files under /after/.
 */
export default {
  ...testcaseConfig,
  sourceDir: 'site/after',
  base: '/after/',
  notFoundRoute: '/404',
  crawl: false,
  verify: true,
  audit: false,
  sitemap: true,
  llmsTxt: true,
  preloadManifest: true,
  metadata: {
    ...testcaseConfig.metadata,
    siteUrl: process.env.DEMO_ORIGIN ?? 'https://snappy-demo.example',
    defaultImage: '/og-card.png',
  },
};
