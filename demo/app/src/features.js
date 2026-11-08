/**
 * Feature summaries shared by the demo SPA and the generated releases page. Keeping one
 * source stops the landing cards and the releases page from drifting apart.
 */
export const FEATURES = [
  [
    'Frameworks',
    'React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla JavaScript, including React 16.8 through 19, Vite 6/7/8 and Create React App; any app that builds to a static directory works.',
  ],
  [
    'Prerendering',
    'Static HTML per route, directory or flat output, 404.html, route includes and excludes, crawl depth and route caps, route priority, route files, sitemap-seeded routes, per-route overrides, ready contracts, retries, traces and screenshots.',
  ],
  [
    'Rendering',
    'Playwright with installed Chrome or Edge, hash-verified Chrome for Testing fallback, third-party blocking with host allowlists, authenticated storage state, viewport and browser controls, scroll-to-load and animation freezing.',
  ],
  [
    'Hydration',
    'Per-route hydration verification, framework detection, strict, allow-rerender and skip policies, changed-only verification, verification-context reuse and per-route failure gates.',
  ],
  [
    'SEO and discovery',
    'Per-route title, description, robots and canonical tags, Open Graph, Twitter cards, JSON-LD, a built-in Head layer that replaces React Helmet, client-side head reconciliation, sitemap and image sitemap output, sitemap lastmod, opt-in llms.txt route indexes, robots directives and AI-crawler-readable HTML.',
  ],
  [
    'Locales',
    'Path and single-locale modes, hreflang and x-default, canonical and og:locale, per-locale routes, cookies, localStorage and storage state, and cookie or localStorage SEO-locale seeding.',
  ],
  [
    'Incremental builds',
    'Persistent route cache, API and vendor-asset revalidation, trust, maxAge and exclude modes, per-route opt-out, cache locking with stale-lock recovery and cache pruning for HTML, generated scripts and vendored assets.',
  ],
  [
    'Output optimisation',
    'Inline or critical CSS, HTML and CSS minification, preconnect hints, font, image and module preload hints, preload manifest, strict and hash CSP, async and external scripts, tag and attribute surgery, build-origin metadata stripping and stale-route pruning.',
  ],
  [
    'Assets and state',
    'Vendor localization for CSS, fonts, images and scripts with content hashing, SRI checks, byte and type limits and redirect or private-host rejection; CSS-in-JS and constructable stylesheet capture; form-state capture; Ajax replay through window.snapStore; self-contained asset gate.',
  ],
  [
    'Auditing and operations',
    'Broken-link, SEO, sitemap and CSP audit; duplicate-content and title detection; empty-page and failed-request gates; content drift baselines; deterministic time, timezone and random seed; JSON reports; dry runs, destinations, base paths, serveCmd and bounded concurrency.',
  ],
  [
    'Interfaces',
    'Vite plugin, CLI, interactive init wizard, react-snap config migration and programmatic API.',
  ],
];
