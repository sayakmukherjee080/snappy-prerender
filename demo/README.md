# Before/after demo

A live demo of snappy-prerender, the framework-agnostic react-snap alternative: the same vanilla
Vite SPA built twice. The package supports React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember
and vanilla JavaScript; the landing page lists the validated versions.

- `/before/`: the normal SPA output, with an empty `#root` until the module script runs.
- `/after/`: the same output after `snappy-prerender` has written the settled DOM per route as
  static HTML.

The landing page compares the two with a captured four-stage playback and crawler-visible
HTML metrics. The SPA pane starts with the raw empty `#root`, then shows the header, hero, and
full content at 0 / 500 / 1,100 / 1,800 ms. The prerendered pane is full at t=0 and its later
frames show the same document after hydration. Separate iframes show the raw HTML source as a
crawler receives it. WhatsApp, X and Facebook previews use the generated Open Graph tags.
The header links to `/releases/`, which the build generates from the repository's
`CHANGELOG.md`.

## Features

- **Frameworks:** React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla JavaScript,
  including React 16.8 through 19, Vite 6/7/8 and Create React App; any app that builds to a
  static directory works.
- **Prerendering:** static HTML per route, directory or flat output, `404.html`, route
  includes/excludes, crawl depth and route caps, route priority, route files, sitemap-seeded
  routes, per-route overrides, ready flag/selector/network settle, retries, traces and
  screenshots.
- **Rendering:** Playwright with installed Chrome or Edge, hash-verified Chrome for Testing
  fallback, third-party blocking with host allowlists, authenticated storage state, custom
  viewport/user agent/HTTPS/launch arguments, scroll-to-load and animation freezing.
- **Hydration:** per-route hydration verification, framework detection, strict/re-render/skip
  policies, changed-only verification, verification-context reuse and per-route failure gates.
- **SEO and discovery:** per-route title, description, robots and canonical tags, Open Graph,
  Twitter cards, JSON-LD, a built-in `Head` layer that replaces React Helmet, client-side head
  reconciliation, sitemap and image sitemap output, sitemap lastmod, opt-in `llms.txt` route
  indexes, robots directives and AI-crawler-readable HTML.
- **Locales:** path and single-locale modes, hreflang and x-default, canonical and `og:locale`,
  per-locale routes, cookies/localStorage/storage state, and cookie/localStorage SEO-locale
  seeding.
- **Incremental builds:** persistent route cache, API and vendor-asset revalidation,
  trust/maxAge/exclude modes, per-route opt-out, cache locking with stale-lock recovery and
  cache pruning for HTML, generated scripts and vendored assets.
- **Output optimisation:** inline or critical CSS, HTML/CSS minification, preconnect hints,
  font/image/module preload hints, preload manifest, strict/hash CSP, async and external
  scripts, tag/attribute surgery, build-origin metadata stripping and stale-route pruning.
- **Assets and state:** vendor localization for CSS, fonts, images and scripts with content
  hashing, SRI checks, byte/type limits and redirect/private-host rejection; CSS-in-JS and
  constructable stylesheet capture; form-state capture; Ajax replay through `window.snapStore`;
  self-contained asset gate.
- **Auditing and operations:** broken-link, SEO, sitemap and CSP audit; duplicate-content/title
  detection; empty-page and failed-request gates; content drift baselines; deterministic
  time/timezone/random seed; JSON reports; dry runs, destinations, base paths, `serveCmd` and
  bounded concurrency.
- **Interfaces:** Vite plugin, CLI, interactive `init` wizard, react-snap config migration and
  programmatic API.

## Build

From the repository root:

```sh
node demo/build.mjs
```

Set the public origin that the build uses for canonical, Open Graph, sitemap and robots.txt URLs
when building for a real host:

```sh
DEMO_ORIGIN=https://demo.example.com node demo/build.mjs
```

The build writes a root `sitemap.xml` and `robots.txt` for the landing page, releases page and
prerendered routes, in addition to the prerendered build's own sitemap.

## Framework coverage

The landing page includes the validated framework and version table. The source of truth is
[`testcase/README.md`](../testcase/README.md#validation-status), which covers React, Vue, Svelte,
Preact, Angular, Solid, Lit, Ember and vanilla JavaScript.

## Discovery

The landing page and releases page carry canonical, Open Graph and Twitter Card metadata. The
landing page also emits `WebPage` and `SoftwareApplication` JSON-LD. The root `robots.txt` keeps
the intentionally empty `/before/` build and the `/playback/` snapshots out of search results.

## Serve

```sh
node demo/serve.mjs --port 4180
```

Open `http://127.0.0.1:4180/`. The landing page is served at `/`, the SPA at `/before/`,
and the prerendered build at `/after/`.

The build generates `demo/site/`, and git ignores it.
