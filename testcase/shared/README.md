# Shared site layer

This folder is the framework-agnostic core used by the eight testcase implementations.

## Content and styles

- `content/` is the same catalog the React reference renders: satellites, stations, docs, models,
  solutions, customers, regions, resources, blog, legal, and labs.
- `styles/` is the complete design system. `styles/site.css` imports every stylesheet in the same
  order as the React app.
- `lib/` contains the pure helpers (slug, pricing estimate, dollar formatting) and the Spaceflight
  News API client with its timeout, validation, sanitisation, and retry rules.

## Routes

`routes.js` exports the 254-route manifest, the not-found record, `getAllRoutePaths`, and
`routeCount`. Each record carries its page key, layout, props, hidden flag, metadata function, and
breadcrumbs function. The manifest is pure data, so every app and the prerender configs can import
it without a framework runtime.

## Rendering

`render/index.js` exports `renderRoute` and `renderDocument`. `renderDocument` returns the complete
page HTML plus the title, description, noindex flag, and head-only flag. Page builders live in
`render/home.js`, `render/platform.js`, `render/network.js`, `render/pricing.js`,
`render/company.js`, `render/api.js`, and the split `render/catalog-*.js` files. `render/base.js`
holds the shared mastheads, sections, chrome, palette, and gate. `render/widgets.js` renders every
data-page widget.

## Runtime

- `runtime/router.js` — path normalisation, parameter matching, and specificity scoring.
- `runtime/site.js` — `createSiteApp({ renderHtml, mountIslands, getRoot })`, the controller that
  owns location state, metadata, preferences, the demo gate, the live news cache, and navigation.
- `runtime/islands.js`, `runtime/islands-content.js`, `runtime/islands-lab.js`,
  `runtime/islands-api.js` — DOM behaviours mounted after each render: palette, mobile menu,
  filters, pricing, orbit calculator, contact form, copy buttons, lab gate, lab demos, and API
  retry/image fallback.
- `runtime/preferences.js`, `runtime/hidden.js`, `runtime/news.js`, `runtime/palette.js` — the
  stores and cache used by the controller and islands.

The host app supplies only the framework-specific HTML binding. Vue awaits `nextTick`, Svelte
awaits `tick`, Preact uses `flushSync`, Angular writes the host element, Solid awaits a microtask,
Lit renders with its `render` function, Ember awaits a timeout, and vanilla writes `innerHTML`.
