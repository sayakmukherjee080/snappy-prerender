/**
 * Prerender configuration for the demo's after build. The Vite build is produced
 * under /after/, so the prerender base and every absolute URL use the same prefix.
 */
export default {
  sourceDir: 'site/after',
  base: '/after/',
  include: ['/', '/pricing', '/docs', '/404'],
  notFoundRoute: '/404',
  metadata: {
    siteUrl: process.env.DEMO_ORIGIN ?? 'https://snappy-demo.example',
    siteName: 'snappy-prerender',
    trailingSlash: 'always',
  },
  verify: false,
  audit: false,
  sitemap: true,
  preloadManifest: true,
};
