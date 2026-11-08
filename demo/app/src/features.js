/**
 * Plain-language benefits shared by the demo SPA, the landing page and the releases
 * page. Keeping one source stops the three surfaces from drifting apart.
 */
const DOCS = 'https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs';

export const FEATURES = [
  [
    'Static HTML for every route',
    'Crawlers get the page content, title and links in the first response, before any JavaScript runs.',
    `${DOCS}/configuration.md`,
  ],
  [
    'Metadata that travels',
    'Titles, descriptions, canonicals, Open Graph, Twitter cards and JSON-LD are written into each page and kept current during client navigation.',
    `${DOCS}/head.md`,
  ],
  [
    'Sitemap, robots and llms.txt',
    'Write a sitemap, update robots.txt and generate an llms.txt route index for AI crawlers from the pages you actually built.',
    `${DOCS}/output.md`,
  ],
  [
    'A check after boot',
    'Each page is reloaded with your real bundle and reported as hydrated, re-rendered or undetected, with per-route policies.',
    `${DOCS}/hydration.md`,
  ],
  [
    'Faster repeat builds',
    'Reuse unchanged routes, revalidate API data and downloaded assets, and protect the cache from concurrent builds.',
    `${DOCS}/configuration.md#incremental-builds-and-assets`,
  ],
  [
    'Assets and output tuning',
    'Localize third-party CSS, fonts, images and scripts; control critical CSS, minification, preloads and CSP; capture CSS-in-JS, form and Ajax state.',
    `${DOCS}/output.md`,
  ],
  [
    'Locales without guesswork',
    'Path or single-locale builds with hreflang, localized URLs, sitemap alternates and SEO locale seeding.',
    `${DOCS}/locales.md`,
  ],
  [
    'Audit and drift reports',
    'Find broken links, metadata, sitemap and CSP problems, compare builds against a baseline, and write a JSON report.',
    `${DOCS}/audit.md`,
  ],
];
