# Aether Compute testcase implementations

Eighteen implementations of the Aether Compute site: the current framework versions and the
requested historical versions, all publishing the same 254 routes and design system, with React
as the reference.

| Folder | Framework | Build |
| --- | --- | --- |
| `react/` | React 19.2 (reference implementation) | `npm run build` |
| `vue/` | Vue 3.5 | `npm run build` |
| `svelte/` | Svelte 5 | `npm run build` |
| `preact/` | Preact 11 | `npm run build` |
| `angular/` | Angular 22 (plain JS decorators, JIT) | `npm run build` |
| `solid/` | Solid 1.9 | `npm run build` |
| `lit/` | Lit 3.3 | `npm run build` |
| `ember/` | Ember 7.3 with Vite/Embroider | `npm run build` |
| `vanilla/` | Vanilla JavaScript | `npm run build` |
| `react-16.8.0/` | React 16.8.0 + Vite 2 | `npm run build` |
| `vue-3.0.0/` | Vue 3.0.0 + Vite 2 | `npm run build` |
| `preact-10.5.4/` | Preact 10.5.4 + Vite 2 | `npm run build` |
| `svelte-3.29.0/` | Svelte 3.29.0 + Rollup | `npm run build` |
| `angular-10.1.6/` | Angular 10.1.6 + Vite 2 | `npm run build` |
| `ember-3.22.0/` | Ember 3.22.0 + Ember CLI | `npm run build` |
| `lit-1.3.0/` | lit-html 1.3.0 + lit-element 2.4.0 + Vite 2 | `npm run build` |
| `solid-0.20.3/` | Solid 0.20.3 + Vite 2 | `npm run build` |
| `react-19.2-vite-6.0.0/` | React 19.2.0 + Vite 6.0.0 | `npm run build` |

## Shared layer

`shared/` holds the parts that are not framework-specific:

- `shared/content/` — the catalog data used by every page.
- `shared/styles/` — the complete design system, imported by every app.
- `shared/lib/` — slug, pricing, formatting, and Spaceflight News API utilities.
- `shared/routes.js` — the 254-route manifest and route metadata.
- `shared/render/` — framework-agnostic HTML for every page, including the docs and lab layouts.
- `shared/runtime/` — router matching, preference and demo-gate stores, the live news cache, the
  site controller, and the DOM island behaviours (palette, filters, pricing, lab demos).

Each framework app owns its bootstrap, its HTML binding, and its document lifecycle. The shared
controller calls the app's `renderHtml` hook and then mounts the islands against the rendered DOM.

`ember-3.22.0/` builds in Ember CLI development mode because the legacy production pipeline
mangles the AMD module graph on current Node. The output is complete and functional; only the
minification step is skipped.

## Run an implementation

```sh
cd testcase/vue
npm install
npm run dev
```

Every app also has `snappy.config.js` and `snappy.labs.config.js`, which point the prerenderer at
the same route set and lab overrides as the React reference.

## Parity notes

- All 254 public routes use the same catalog content, page structure, class names, and metadata.
- The shared controller reads `metadata.siteUrl` and `trailingSlash` from the prerender metadata, so
  canonical and Open Graph URLs point at the public site instead of the build server.
- API article routes use the live article title and summary for their document metadata, with a
  unique fallback when the source omits a record.
- The `/api` index and the fifty `/api/articles/:index` pages fetch the Spaceflight News API at
  runtime, with the same timeout, validation, sanitisation, retry, and in-memory cache. The
  validation harness can point the client at a deterministic local API by setting the
  `snappy.news.api` cookie to the base URL; normal runs use the live source.
- The hidden lab gate and its 23 demo routes exist in every app. The demo bodies are implemented
  with each host framework's own primitives; the React-specific lab APIs (`Activity`,
  `useEffectEvent`, `useActionState`, and similar) are not portable, so those labs are native
  equivalents rather than line-for-line ports.

## Hydration verification

React hydrates the prerendered component tree and runs the package's hydration verification.
Preact and Vue adopt the container but replace the string-rendered body on boot, so the build
reports a re-render and allows it. The historical prerender-only hosts (React 16.8, Vue 3.0,
Preact 10.5, Svelte 3.29, Angular 10, Ember 3.22, Lit 1.3 and Solid 0.20) keep
`hydration.skip: ['/*']`; their configs validate rendering, metadata, audit, sitemap, preload
and browser output instead. The React 19.2/Vite 6.0 historical host runs full verification.

Every host wrapper clears or replaces the prerendered root before mounting, so booting the app
replaces the static page rather than appending a second copy. Ember 3.22 does this through the
deferred `public/ember-boot-guard.js`, which removes the captured `ember-application` class and
application view before the app boots. Svelte 3.29 and Solid 0.20 clear `#root` in their entry
modules. Lit 1.3 and Svelte 3.29 set `framework` explicitly because their client renders leave no
DOM marker the package can detect.

## Validation status

Validated on 2026-11-07 with `snappy-prerender` 2.11.3 on Node 24.21.0.

| Tier | Implementations |
| --- | --- |
| Prerender validated | React 16.8.0, 19.2.0; Vue 3.0.0, 3.5.44; Preact 10.5.4, 11.1.1; Svelte 3.29.0, 5.57.3; Angular 10.1.6, 22.2.4; Ember 3.22.0, 7.3.0; Lit 1.3.0, 3.3.3; Solid 0.20.3, 1.9.18; Vanilla; Vite 6.0.0, 7.3.7, 8.3.5 |
| Hydration validated | React 19.2.0 (modern and legacy Vite 6): 204 routes hydrated, 51 API routes re-rendered and allowed |
| Boot verified with allowed re-render | Vue 3.5.44 and Preact 11.1.1: 255 routes re-rendered; no hydration claim |
| Prerender-only | Angular, Ember, Lit, Solid, Svelte, vanilla and the eight prerender-only historical hosts: `hydration.skip: ['/*']` |

| Implementation | Version | 255 routes | Audit | Browser 204 static + 51 API | Incremental 255/255 | Hydration tier |
| --- | --- | --- | --- | --- | --- | --- |
| React | 19.2.0 | pass | 0 errors | pass | pass | hydrated + allowed API re-render |
| Vue | 3.5.44 | pass | 0 errors | pass | pass | re-render allowed |
| Svelte | 5.57.3 | pass | 0 errors | pass | pass | prerender-only |
| Preact | 11.1.1 | pass | 0 errors | pass | pass | re-render allowed |
| Angular | 22.2.4 | pass | 0 errors | pass | pass | prerender-only |
| Solid | 1.9.18 | pass | 0 errors | pass | pass | prerender-only |
| Lit | 3.3.3 | pass | 0 errors | pass | pass | prerender-only |
| Ember | 7.3.0 | pass | 0 errors | pass | pass | prerender-only |
| Vanilla | — | pass | 0 errors | pass | pass | prerender-only |
| React | 16.8.0 | pass | 0 errors | pass | pass | prerender-only |
| Vue | 3.0.0 | pass | 0 errors | pass | pass | prerender-only |
| Preact | 10.5.4 | pass | 0 errors | pass | pass | prerender-only |
| Svelte | 3.29.0 | pass | 0 errors | pass | pass | prerender-only |
| Angular | 10.1.6 | pass | 0 errors | pass | pass | prerender-only |
| Ember | 3.22.0 | pass | 0 errors | pass | pass | prerender-only |
| Lit | lit-element 2.4.0 + lit-html 1.3.0 | pass | 0 errors | pass | pass | prerender-only |
| Solid | 0.20.3 | pass | 0 errors | pass | pass | prerender-only |
| React + Vite | 19.2.0 + 6.0.0 | pass | 0 errors | pass | pass | hydrated + allowed API re-render |

Every implementation passed:

- Build and prerender of 255 routes: 254 public routes plus `/404`.
- A 230-entry sitemap and a 254-entry preload manifest.
- Browser output on all 204 static routes: one `h1`, title, description, canonical URL, local
  assets and no page errors.
- JavaScript-disabled output on all 51 API routes and mocked-API client rendering on `/api` and
  `/api/articles/1`.
- All 24 lab routes with no browser failures.
- Incremental validation in four passes per framework: initial render, unchanged reuse, changed
  API response, and reuse of the changed output.
- Vendor localization against the real Google Fonts CSS/fonts, followed by incremental reuse,
  on all 18 implementations.
- Knob validation for `trust`, `maxAge`, `exclude`, per-route opt-out, API host allowlists,
  response byte limits, verification reuse, and the self-contained asset gate.
- Full 255-route React run with a deterministic mock API: 255 routes, 0 audit errors, 230
  sitemap entries, 254 preload entries, and 255/255 reused on the second run with one
  deduplicated API revalidation.
- Cache locking and pruning: concurrent builds sharing one cache serialize instead of
  racing, stale locks are reclaimed, and unreferenced HTML, generated scripts and vendored
  assets are removed.
- Locale and SEO incremental matrix: path and single modes, hreflang and canonical output,
  generated locale scripts, locale changes and storage-state changes invalidate the cache.
- Vendor combinations: vendor localization with `inlineCss: 'inline'`/`'critical'`, CSP
  hash/strict modes, preload links and the preload manifest, all reused from the cache.
- Base path matrix: `/app/` canonical, sitemap, local asset and preload-manifest paths,
  browser rendering and a 2/2 cached second run.
- Capped crawl matrix: `maxRoutes` and `routePriority` produce a stable accepted set,
  record dropped routes, and reuse accepted routes on later runs.
- Live API cycle: 255 live routes, 255/255 reused with one API revalidation and the known
  duplicate live-headline audit entry.
- Vendor mutation on all 18 implementations: changing a mocked CDN stylesheet produces a
  new local hash, invalidates only the affected route and re-renders it.
- Real build wipe on all 18 implementations: a real `npm run build` between runs restores
  cached routes. Ember 3.22 rebuilds its `vendor.js` with fresh bytes, so that host correctly
  invalidates and re-renders instead of reusing stale assets.
- Browser interactions on all 18: palette open/search/shortcut, brand navigation, mobile
  menu and lab route boot.
- Vendor security: SRI mismatch in the browser, redirects outside the allowlist, private
  hosts, byte limits, wrong content types, and `warn`/`fail` outcomes.
- `serveCmd` and image output disable incremental caching with a warning and write no cache.

The only audit error in the live-API runs is the Spaceflight News duplicate headline at
`/api/articles/29` and `/api/articles/31`; the API data, not the build, supplies that title.
The deterministic mock-API runs have zero audit errors.

