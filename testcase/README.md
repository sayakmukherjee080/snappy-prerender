# Aether Compute testcase implementations

Nine implementations of the Aether Compute site, one per framework, all publishing the same
254 routes and design system, with React as the reference.

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
  runtime, with the same timeout, validation, sanitisation, retry, and in-memory cache.
- The hidden lab gate and its 23 demo routes exist in every app. The demo bodies are implemented
  with each host framework's own primitives; the React-specific lab APIs (`Activity`,
  `useEffectEvent`, `useActionState`, and similar) are not portable, so those labs are native
  equivalents rather than line-for-line ports.

## Hydration verification

React hydrates the prerendered component tree and runs the package's hydration verification.
Preact and Vue adopt the container but replace the string-rendered body on boot, so the build
reports a re-render and allows it. Angular, Lit, Solid, Svelte, Ember, and vanilla are
prerender-only host wrappers: their configs skip hydration verification and validate rendering,
metadata, audit, sitemap, and the preload manifest instead. Every host wrapper clears the
prerendered root before mounting, so booting the app replaces the static page rather than
appending a second copy of it underneath.

