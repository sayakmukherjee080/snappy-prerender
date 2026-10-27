/**
 * Prerender settings for the Aether Compute site. The five public routes and the
 * not-found route are listed explicitly so a run covers exactly the pages the site
 * publishes, and the public address feeds canonical, social and sitemap URLs.
 */
const config = {
  sourceDir: 'dist',
  include: ['/', '/platform', '/network', '/pricing', '/company', '/seo', '/private', '/404'],
  notFoundRoute: '/404',
  metadata: {
    siteUrl: 'https://aethercompute.space',
    siteName: 'Aether Compute',
    trailingSlash: 'always',
  },
  sitemap: true,
  preloadManifest: true,
};

export default config;
