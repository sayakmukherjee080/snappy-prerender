<p align="center">
  <img src="assets/snappy-logo.png" width="150" alt="snappy-prerender logo">
</p>

# snappy-prerender

Render a single-page app to static HTML at build time. Point the tool at the build output; it renders each route in Chrome, writes one HTML file per route, and leaves the app unchanged. The output includes page content, titles, meta tags, canonical links and Open Graph tags.

Version 2.8 adds deterministic clock and randomness controls, locale and hreflang generation, cookie/localStorage SEO locale seeding, and a client-side head layer that replaces React Helmet or React Helmet Async for prerendered apps.

[![npm](https://img.shields.io/npm/v/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![npm downloads](https://img.shields.io/npm/dm/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![node](https://img.shields.io/node/v/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![license](https://img.shields.io/npm/l/snappy-prerender.svg)](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/LICENSE)

<a href="https://www.producthunt.com/products/snappy-prerender?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-snappy-prerender" target="_blank" rel="noopener noreferrer"><img alt="snappy-prerender - Turn your existing SPA into static HTML | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1297695&amp;theme=neutral&amp;t=1793431121819"></a>

Package page: [npmjs.com/package/snappy-prerender](https://www.npmjs.com/package/snappy-prerender). Install with `npm install --save-dev snappy-prerender`. Release notes are in [CHANGELOG.md](CHANGELOG.md).

- No SSR entry, framework migration or app changes. If the app builds to a directory, it can be prerendered.
- React 16.8, 17, 18 and 19, Vite 6/7/8, or any static build.
- Based on the react-snap approach, reimplemented for current toolchains with Playwright and a hydration check.

## Who this is for

Use it for client-rendered apps that need crawler-visible HTML: Create React App, Vite + React, other SPAs, CMS-backed sites and client-routed marketing pages.

Do not use it for apps that already render HTML on the server, such as Next.js, Remix or Astro.

## Quick start

### Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import snappy from 'snappy-prerender';

export default defineConfig({
  plugins: [react(), snappy()],
});
```

`vite build` now prerenders the output directory. Rendering failures fail the build; hydration is reported unless you opt into enforcement.

### Init wizard

```sh
npm install --save-dev snappy-prerender
npx snappy-prerender init
```

A few questions — build directory, base path, routes, site URL, site name, title template — then it writes `snappy.config.js` with only the options you set, and prints install, run and head-layer next steps. It reads your project first, so a Vite app is offered `dist`, a Create React App `build`, and the commands match your package runner.

```sh
npx snappy-prerender init --yes        # accept every default, for a shell without a terminal
npx snappy-prerender init --force      # replace an existing snappy.config.js
npx snappy-prerender init --metadata-site-url https://example.com   # flags answer the questions
```

### CLI

For any static output directory, Vite or not:

```sh
npm install --save-dev snappy-prerender

npx snappy-prerender dist
npx snappy-prerender dist --include /,/pricing,/blog/* --exclude /blog/drafts/*
npx snappy-prerender dist --block-third-party --allowed-hosts cms.example.com
npx snappy-prerender dist --metadata-site-url https://example.com --metadata-title-template '%s | Example'
npx snappy-prerender dist --inline-css critical --minify-html --preload-manifest
npx snappy-prerender dist --sitemap --verify-changed-only
npx snappy-prerender dist --csp strict --inline-css critical
```

### Programmatic

```js
import { prerender } from 'snappy-prerender/core';

const report = await prerender({ sourceDir: 'dist', include: ['/'] });
if (!report.ok) {
  for (const failure of report.verification?.routes.filter((entry) => !entry.ok) ?? []) {
    console.error(failure.route, failure.hydrationErrors);
  }
  for (const failure of report.errors) console.error(failure.route, failure.message);
}
```

## Based on react-snap

[react-snap](https://github.com/stereobooster/react-snap) showed that a browser and a build step can produce crawler-readable HTML without a server renderer. It has been unmaintained since 2019.

snappy-prerender reimplements that approach; no react-snap code is reused. It uses Playwright, resolves an installed Chrome or Edge, supports Vite, ships a head layer, and verifies hydration.

If you are moving over, [Migrating from react-snap](docs/react-snap-migration.md) maps the options.

## What you get

| | |
| --- | --- |
| **Static HTML per route** | `route/index.html` (or `route.html` with `flatOutput`), plus `404.html`. Identical files are left untouched. |
| **Head and metadata** | Per-route title, description, robots, canonical, Open Graph and Twitter tags, updated on client-side navigation. |
| **Hydration report** | Each route is reloaded with the real bundle and reported as `hydrated`, `re-rendered`, `undetected` or `unknown`, with mismatch messages. |
| **Ready contract** | `window.__prerenderReady`, a selector, or network quiescence. |
| **Output optimisation** | Critical CSS, HTML/CSS minification, preconnect hints, image preload, a preload manifest, script and style removal. |
| **CSS-in-JS support** | CSSOM-only styles and constructable stylesheets are written back into the HTML. |
| **Ajax state replay** | Captured JSON and `window.snapSaveState()` are injected before the first script. |
| **Guided setup** | `snappy-prerender init` writes a `snappy.config.js` from the project settings and a few answers. |
| **Any static build** | Base paths, `serveCmd`, screenshots, dry runs and bounded concurrency. |

## How it works

1. Serves the built output on an ephemeral loopback port, or copies it to `destination`.
2. Crawls same-origin links from the seed routes in a fresh browser context per page.
3. Waits for the ready contract, quiet network, fonts and two animation frames.
4. Freezes CSS animations, optionally blocks third-party requests, records resources and reconciles head tags.
5. Serialises the DOM and post-processes it: removes freeze styles and `data-prerender-remove` elements, de-duplicates head styles, drops dead blob stylesheets, adds link hints, optionally inlines CSS, removes or marks scripts, optionally minifies, and records metadata issues.
6. Writes `route/index.html` or a screenshot, leaving identical files untouched.
7. Reloads each written file with the client bundle and reports hydration errors and boot mode.

## Head and metadata

Per-route titles, descriptions, canonical links and Open Graph/Twitter tags come from the package's `Head` component. It updates the document head on every render, including client-side navigation, and the prerenderer captures the result.

```jsx
import { Head } from 'snappy-prerender/head';

<Head
  title="Awards"
  description="Awards presented by the society"
  image="/share/awards.png"
  type="article"
  locale="en_GB"
  robots="index,follow"
  lang="en"
  dir="ltr"
  structuredData={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Awards' }}
  alternates={[
    { hreflang: 'en', href: '/awards' },
    { hreflang: 'x-default', href: '/awards' },
  ]}
  extra={[{ name: 'keywords', content: 'polymer' }, { rel: 'alternate', href: '/feed.xml' }]}
/>
```

Project-wide values come from the `metadata` option. The prerenderer injects them into every page, so the component builds absolute URLs from the public site instead of the build server:

```js
snappy({
  metadata: {
    siteUrl: 'https://example.com',
    siteName: 'Example',
    titleTemplate: '%s | Example',
    defaultTitle: 'Example',
    defaultImage: '/share.png',
    trailingSlash: 'never', // 'preserve' | 'always' | 'never'
  },
});
```

### Replacing React Helmet or React Helmet Async

For a client-rendered app, `Head` covers the tag and attribute surface React Helmet and React Helmet Async expose on the client. An app does not need either package:

```jsx
<Head
  title="Awards"
  titleAttributes={{ itemProp: 'name' }}
  htmlAttributes={{ className: 'theme-dark', 'data-theme': 'dark' }}
  bodyAttributes={{ className: 'root', 'data-scroll': 'locked' }}
  images={['/share/awards.png', '/share/awards-square.png']}
  alternateLocales={['en_GB', 'fr_FR']}
  tags={[
    { tag: 'base', attrs: { href: '/' } },
    { tag: 'script', attrs: { src: '/analytics.js', async: true } },
    { tag: 'script', attrs: { type: 'application/json' }, text: '{"feature":true}' },
    { tag: 'style', attrs: { media: 'screen' }, text: 'body { color: #111 }' },
    { tag: 'noscript', html: '<img src="/pixel.png" alt="">' },
  ]}
  onChangeClientState={(state, added, removed) => {}}
/>
```

`Head` does not accept JSX children; use `tags`, `extra` or the props below for every value.

`tags` accepts `script`, `style`, `noscript` and `base`:

- `attrs` takes arbitrary attributes. `true` emits an empty attribute; `false`, `null` and `undefined` omit it. `className`, `htmlFor`, `httpEquiv` and the other React spellings map to their DOM names.
- `text` sets `textContent` for `script`, `style` and `noscript`. A closing-tag sequence inside script or style text is escaped, so the value cannot terminate its own element.
- `html` sets trusted `innerHTML` on `noscript` only. Never pass untrusted input.
- `key` gives a tag an explicit identity. Without one, external scripts key by `src` and inline tags key per mounted `Head`, so several scripts or styles survive together.
- `base` is a singleton; the last mounted `Head` that sets one wins.

`htmlAttributes`, `bodyAttributes` and `titleAttributes` write arbitrary attributes on the document element, body and generated title. Values the document already had are restored when no Head wants them, including after client-side navigation and after a prerendered page hydrates. `lang` and `dir` remain shortcuts; an entry in `htmlAttributes` wins when both are supplied.

`defaultTitle` fills the document title only when no mounted Head supplied a real `title`. It is not run through `titleTemplate`. `images` emits one `og:image` per URL and uses the first for `twitter:image`. `alternateLocales` emits one `og:locale:alternate` per value. Both keep every value through the merge.

`extra` stays the escape hatch for additional `meta` and `link` tags. Set `duplicates: true` on repeated same-name metas (for example `article:tag`) so each value keeps its own tag; an explicit `key` still works.

`onChangeClientState(state, added, removed)` runs after a real DOM change, not on every render. `state` groups the merged entries into `title`, `meta`, `link`, `script`, `style`, `noscript`, `base`, `htmlAttributes`, `bodyAttributes` and `titleAttributes`. `added` and `removed` are entry descriptors with `kind`, `key` and their value.

React 19 hoists native `<title>`, `<meta>` and `<link>` elements. `Head` adopts an existing tag with the same identity and updates it instead of adding a second one. Use one owner per tag: either React 19 native metadata or `Head`, not both for the same tag. The run still warns when a page ships more than one `<title>`.

The `snappy-prerender/head` entry is plain JavaScript with JSDoc types for `HeadProps`, `HeadTag`, `HeadAttributes`, `HeadChange` and the imperative API. It ships no TypeScript files.

This is a client-side head manager. It deliberately has no `HelmetProvider`, `helmetContext`, `HelmetData`, `renderStatic()`, streaming or server rendering API; the prerenderer renders the real app in a browser and captures the live head.

What it emits, per route: `title` (with the template applied unless the title already carries its suffix), `meta[name=description]`, `meta[name=robots]`, `link[rel=canonical]`, `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`, `og:locale`, and `twitter:card` / `twitter:title` / `twitter:description` / `twitter:image`. Switch a family off with `openGraph: false` or `twitter: false`, and skip the canonical with `canonical: false`.

Rules:
- `metadata` values are defaults; a `Head` prop wins. When several Heads render, the last one wins per tag.
- Tags are matched by the attribute a crawler reads, so existing tags are updated instead of duplicated. Tags that may legitimately repeat keep a value-specific identity, so multiple images, alternate locales, scripts and styles survive.
- `defaultTitle` is used only when no mounted Head supplied a title, and it is never run through `titleTemplate`.
- Generated tags carry `data-snappy-head-created` beside `data-snappy-head`, so a later page load can tell them from tags the app wrote.
- When no Head wants a tag, a generated one is removed and an app-written one is restored to its previous value. That original is recorded in the page during prerendering, together with the original html, body and title attributes.
- The component renders nothing, so it does not affect hydration of page content.
- The title template is skipped when the title already ends with its fixed part, or is the site name, so a hand-built title is not suffixed twice.
- `structuredData` emits `<script type="application/ld+json">` for one object or an array, keyed per mounted `Head`. Values are escaped; add `@context` when needed.
- `lang` and `dir` are written on `<html>`. Later Heads win, and the original values return when no Head wants them. `htmlAttributes` covers every other document attribute, and `bodyAttributes` / `titleAttributes` do the same for body and title.
- `alternateLocales` emits `og:locale:alternate` for each listed locale.
- `alternates` emits `<link rel="alternate" hreflang="...">` with absolute URLs using the same `siteUrl`/`base`/`trailingSlash` policy as canonical links. The same alternates feed sitemap `xhtml:link` entries.
- `og:url`, `og:image` and canonical need absolute URLs. `metadata.siteUrl` must be an origin; put a sub-path deployment in `base`. Without `siteUrl`, build-server URLs are removed by default and the run warns. `trailingSlash` applies to page URLs only. Canonical, social and sitemap URLs share the page-path policy: directory output keeps its slash, flat output stays extensionless, and `trailingSlash` wins.
- `metadata.base` overrides the base path for absolute URLs and defaults to `base`.
- On React 19, React also hoists `<title>`, `<meta>` and `<link>` from JSX. `Head` adopts a matching hoisted `<meta>` or `<link>` and updates it in place. A hoisted `<title>` that already has the Head text is left untouched so React can remove it on navigation; older template titles are removed so the written page has one document title. `titleAttributes` apply only when `Head` owns the title. Use one metadata system; the run warns when a page still ships more than one `<title>`.
- Every metadata value has a CLI flag: `--metadata-site-url`, `--metadata-site-name`, `--metadata-title-template`, `--metadata-default-image`, `--metadata-trailing-slash`.
- `react` is an optional peer dependency for this entry point. Non-React code can call `setHead(id, props)` and `clearHead(id)`.

## Audit, reports and route sources

The audit runs by default and reports:

- route errors, truncation, empty or duplicate output, broken internal links;
- duplicate or missing metadata, canonical mismatches, heading counts, sitemap disagreement and orphan pages;
- CSP violations reported by the browser.

Findings are returned in `report.audit` and logged. They do not fail the run unless `failOnAuditError` is true. `auditIgnoreLinks` excludes dynamic links, and `--no-audit` skips the audit. See [docs/report.md](docs/report.md) for the rule list and JSON schema.

`reportPath` (or `--report`) writes the report as versioned JSON. URLs are reduced to origin and path, and the storage-state path is redacted.

Routes can come from `include` and crawling, from a text/JSON `routesFile`, or from a local or remote sitemap via `routesFromSitemap`. Relative source paths resolve against the config file. Root-relative sitemap locations have `base` stripped, and a remote sitemap's off-origin locations are ignored. If either source is supplied and `include` is not set, the root is not seeded implicitly. With `maxRoutes` or `routePriority`, crawling runs in deterministic breadth-first waves sorted by priority then path. `truncated.droppedRoutes` lists routes that did not fit.

`routeOverrides` applies `timeout`, `waitFor`, `readySelector`, `readyFlag`, `crawl`, `storageState` and `hydration` to matching routes; later entries win per key. `transformHtml` runs once per route after minification and before preload/CSP injection. It may be async and must return a string or nothing.

`preloadLinks` injects `<link rel="modulepreload">` for runtime chunks, font preloads with their response content type, and the LCP image. It complements `preloadManifest`: the manifest is for hosts that send Early Hints, while the injected links work on any static host. Script hints are skipped when `removeScriptTags` is on.

`csp: 'hash'` adds a `<meta http-equiv="Content-Security-Policy">` with SHA-256 hashes for inline scripts and styles. It implies `externalScripts: true` and no CSS swap handler, like `strict`. The policy allows `'self'` only, so third-party scripts or styles need their own policy; the audit warns when the browser reports a blocked request. An existing CSP meta is kept and reported. Inline `style=""` attributes and event handlers cannot be hashed; the audit warns about the attributes.

## Hydration verification

After writing the output, each route is loaded again in a fresh browser context with the client bundle. By default the results are reported but do not fail the build; the static HTML is already written. Set `failOnHydrationError: true` (or pass `--fail-on-hydration-error`) to make hydration a build gate.

**Hydration errors.** Mismatch messages for React, Vue, Svelte and Preact are reported with the route, framework and message. React text mismatches and minified production codes (`#418`, `#423`, `#425`) are recognised; Preact uses the React-compatible messages. A mismatch means the client re-renders the page instead of adopting the static markup. The crawler-visible HTML is unchanged.

The framework is detected from DOM markers only (`__reactContainer`, `__vue_app__`/`__vue__`, `__k`, `data-svelte-h`, Svelte 5's `<!--[-->` hydration anchor, and the Svelte 5 `window.__svelte` runtime global); nothing is imported or executed. Set `framework` when a custom root defeats detection. When a route has hydration errors or re-rendered, `firstMismatch` reports the first difference between the written HTML and the live container as `{ path, kind, expected, actual }`, bounded to 5,000 nodes and depth 20.

A probe installed before the app's scripts run records the container's first prerendered node and the first-element chain beneath it, then checks whether every captured wrapper survived:

| Mode | Meaning |
| --- | --- |
| `hydrated` | The app kept the prerendered markup, including the wrappers beneath the container. |
| `re-rendered` | The app discarded it and rendered from scratch, or kept only the outer wrapper while replacing everything inside it. |
| `undetected` | No framework root was found on the container. |
| `unknown` | The prerendered node was not seen, for example a container outside the usual ids. |

A verification navigation that returns HTTP 4xx/5xx, or a container with no content, is reported as failed with its `status` or `empty` flag. `undetected` and `unknown` are reported as counts; `failOnUndetected: true` fails the build for them. A verification pass that cannot run is listed in `verification.errors`; `failOnVerificationError: true` fails separately from hydration errors.

`re-rendered` usually means the app calls `createRoot` instead of `hydrateRoot`, or mounts a string-rendered shell over a prerendered page. Since `createRoot` does not emit a hydration error, the mode report is the only signal. It is reported per route as `verification.routes[].mode` and summarised in `verification.modes`. Set `failOnRerender: true` to fail the build.

**Page errors.** Uncaught browser errors are reported as warnings, and console errors at debug level. Errors thrown during rendering are counted in the summary and reported per route; `failOnPageError: true` makes them fail the build. By default the static HTML is still written.

**React 16 and 17.** Hydration and boot modes are judged the same way, and their dev mismatch warnings are recognised. Their production builds report nothing for a mismatch, so the boot mode (`hydrated` versus `re-rendered`) is the signal.

**Rebuilds.** `verifyChangedOnly: true` skips verification for routes whose HTML file did not change. The report shows how many routes were skipped.

## Deterministic time

Copyright lines and dated content often differ between prerendering and the verification reload. Fix the clock for both passes:

```js
snappy({
  freezeTime: true,       // SOURCE_DATE_EPOCH, or the run start
  timezone: 'UTC',
  randomSeed: 42,         // optional; deterministic Math.random for demo content
});
```

`freezeTime` also accepts an ISO string or epoch milliseconds, which is the reproducible-build option:

```js
freezeTime: '2026-05-04T12:00:00Z'
```

Playwright's fixed clock is installed before navigation and keeps real timers running, so settling and scheduled work are unaffected. The page can read `window.__SNAPPY_NOW__` (epoch ms) or `window.__SNAPPY_NOW_ISO__`. `SOURCE_DATE_EPOCH` is honoured when `freezeTime` is `true`. A fixed clock is a build and verification control only: production still uses real time. For a live clock, render it client-only or use a hydration allow-list. `performance.now()` is not frozen because schedulers rely on it.

## Hydration policies

If a route is intentionally live or random, allow its re-render explicitly instead of suppressing verification globally:

```js
snappy({
  hydration: {
    allowRerender: ['/status', '/live/*'],
    skip: ['/admin/*'],
  },
  routeOverrides: [
    { match: '/live/private', hydration: 'strict' },
  ],
});
```

`allow-rerender` keeps the mode in the report but moves its hydration errors to `ignoredHydrationErrors` and does not fail the run. `skip` omits the route from verification and records it in `verification.skippedRoutes`. A matching `routeOverrides[].hydration` wins over the global lists; `skip` wins if both global lists match. The CLI flags are `--allow-rerender` and `--skip-hydration`.

## Locales and hreflang

`locales` adds config-driven language metadata. Existing manual `Head` props still win; generated tags only fill missing values.

```js
snappy({
  locales: {
    mode: 'path',
    default: 'en',
    xDefault: 'en',
    hreflang: true,
    list: [
      { code: 'en', prefix: '', htmlLang: 'en', ogLocale: 'en_US' },
      {
        code: 'fr',
        prefix: '/fr',
        htmlLang: 'fr',
        ogLocale: 'fr_FR',
        routes: { '/about': '/a-propos' },
      },
    ],
  },
});
```

In `path` mode, the default locale is crawled once and every locale variant is rendered from the same base routes. `routes` maps translated slugs; a value is the path without the locale prefix. In `single` mode, `active` selects the locale rendered in this build and `list[].url` supplies the other deployments for hreflang. A locale entry can carry `locale` (Playwright/navigator), `timezone`, `storageState`, `cookies` and `localStorage`.

The package sets `<html lang>`/`dir` when missing, adds canonical URLs, `og:locale`, `og:locale:alternate`, self/alternate/`x-default` hreflang links, and feeds the same alternates into the sitemap. `Head` also accepts `alternateLocales={['en_US', 'de_DE']}` for app-managed Open Graph tags. The audit checks invalid and duplicate hreflang codes, missing self links, missing `x-default`, reciprocal links inside the same build, and an `<html lang>` that disagrees with the active locale.

Path mode requires one public origin and an app that routes the prefix or uses the translated `routes` map. Hreflang needs distinct crawlable URLs; a cookie-only locale does not create them. Use single mode for separate locale domains.

## Cookie/localStorage SEO locale

For an app whose locale lives in a cookie or `localStorage`, `seoLocale` selects the SEO language before the app boots:

```js
snappy({
  seoLocale: {
    code: 'fr',
    source: 'both',          // 'localStorage' | 'cookie' | 'both'
    localStorageKey: 'locale',
    cookie: { name: 'locale', path: '/', sameSite: 'Lax', secure: false },
    seedRender: true,
    seedVerification: true,
    inject: true,
    overwrite: true,
    forceHtmlLang: true,
    navigator: false,
    routes: ['/*'],
  },
});
```

`seedRender` and `seedVerification` put the value into the prerender and verification browsers. `inject` writes a small bootstrap before the app bundle so real visitors get the same locale the static HTML was rendered in. `overwrite: false` only sets the value when missing, preserving a visitor's existing choice. `forceHtmlLang` overrides an app-owned `<html lang>`; `navigator` also emulates `navigator.language`/`Accept-Language`. In path mode the value comes from each locale's code; in single mode it comes from `locales.active` or `seoLocale.code`.

Under `csp: 'hash'` the bootstrap is hashed with the other inline scripts. Under `csp: 'strict'` or `externalScripts` it is written as a same-origin script. Combining `inject: true` with `removeScriptTags: true` is rejected because the bootstrap would be stripped.

This control does not create new crawlable URLs by itself. In single mode it produces one locale per output; for multiple crawlable locales use path-prefixed locales or separate builds/deployments. With `inject: false` the HTML is localized but a visitor with different storage may see another locale after hydration.

## Ready contract

Most apps work with no configuration because the network-quiet heuristic is enough. Apps that fetch data after load can opt into a stronger signal:

```js
// early in your app
window.__prerenderReady = false;
// when data has rendered
window.__prerenderReady = true;
```

The flag is only awaited when the app defines it. Alternatively use `waitFor` (a selector that must appear on every route) or `readySelector`.

## Detecting the prerenderer

Pages render with `userAgent: 'SnappyPrerender'`, so app code can branch:

```js
const isPrerender = navigator.userAgent === 'SnappyPrerender';
// e.g. skip analytics, or point API calls at a reachable host during the build
```

Set `userAgent: null` to send the browser's default instead.

## Optimising the output

### Critical CSS

```js
snappy({ inlineCss: 'inline' })   // inline every same-origin stylesheet, remove the links
snappy({ inlineCss: 'critical' }) // inline above-the-fold CSS, defer the rest (needs beasties)
snappy({ inlineCss: true })       // alias for 'inline'
```

`'inline'` reads the stylesheet text from the live page, so blob-backed CSS-in-JS sheets are inlined too. Stylesheets that cannot be fetched, and non-screen media such as a print stylesheet, are left as links.

`'critical'` delegates to [beasties](https://github.com/danielroe/beasties):

```sh
npm install --save-dev beasties
```

It inlines the critical CSS and converts the remaining stylesheets to non-blocking loads using `media="print"` plus an inline `onload` handler, with a `<noscript>` fallback. The inline handler is inline JavaScript, so a strict `script-src` without `unsafe-inline` leaves the deferred stylesheets unapplied. Use `'inline'` or a nonce-aware setup in that case.

### Minification

```js
snappy({ minifyHtml: true, minifyCss: true });
```

`minifyHtml` uses html-minifier-terser with react-snap's defaults (whitespace collapsing, boolean attribute collapsing, attribute sorting). **Whitespace collapsing changes text nodes, which React detects during hydration.** Use `{ collapseWhitespace: false }` if the verifier reports mismatches. `minifyCss` is passed to clean-css and also minifies CSS inlined into the HTML.

### Link hints

```js
snappy({ preconnectThirdParty: true, preloadImages: true, preloadManifest: true });
```

- `preconnectThirdParty` (default `true`) records every third-party origin the page tried to reach, including blocked ones, and adds `<link rel="preconnect">` for each.
- `preloadImages` adds `<link rel="preload" as="image">` for same-origin images the page loaded.
- `preloadManifest` writes `preload-manifest.json`: per route, a `Link` header value for the scripts and stylesheets the final HTML still references. Entries respect `ignoreForPreload` (default `['service-worker.js']`), inline CSS, tag removal and the base path. Serve them as Early Hints or `Link` headers.

react-snap called this `http2PushManifest`. Browsers removed HTTP/2 push (Chrome 106), so the manifest is a header list rather than a push list.

### Sitemap

```js
snappy({ sitemap: true, metadata: { siteUrl: 'https://example.com' } });
```

The sitemap is generated from the written routes using the same page-path policy as canonical URLs. `noindex` pages and the not-found route are omitted. Above 50,000 URLs it is split behind a sitemap index. Entries have no `<lastmod>`; a build date would claim every page changed on every build.

When the output directory already has a `robots.txt`, a `Sitemap:` line is appended to it if it does not point anywhere yet; an existing directive is left alone. Without a `robots.txt`, the run logs the exact line to add instead of creating a file you did not ask for.

### Tag surgery

```js
snappy({
  asyncScriptTags: true,   // mark external scripts async
  removeScriptTags: false, // strip every script tag (page works without JS, hydration is lost)
  removeStyleTags: false,  // strip every style tag
  removeBlobs: true,       // drop stylesheet links pointing at dead blob: URLs (default on)
});
```

The persisted metadata element is kept when `removeScriptTags` is on; other scripts are removed.

### Removing volatile markup

Mark any element with `data-prerender-remove` and it is dropped from the output:

```jsx
<div data-prerender-remove>{ads.render()}</div>
```

Use it for regions that only exist after the client takes over, such as ads or chat widgets. Remove markup that React does not render on its first client pass. Removing markup React expects causes the hydration mismatch the verifier reports.

Some libraries stamp values that change on every load. Ant Design's `rc-menu`, for example, writes `data-menu-id="rc-menu-uuid-…"`, which makes every rebuild rewrite every file and leaves `verifyChangedOnly` nothing to skip. List those attribute names (or RegExps) and they are removed from the output:

```js
snappy({ removeAttributes: ['data-menu-id', 'aria-controls'] });
```

As with removed markup, only strip attributes React does not render as props; if you guess wrong, the hydration verifier tells you which route.

### Strict CSP

One dial decides how the injected pieces are delivered. `csp: 'off'` (default) leaves them inline, which is cheapest to load. `csp: 'strict'` makes the whole output work under `script-src 'self'` with no `unsafe-inline`:

| Piece | `off` | `strict` |
| --- | --- | --- |
| Head defaults | Inert `<script type="application/json" data-snappy-meta>` — never executed, so `script-src` does not govern it | Same |
| Captured state | Inline script, injected before the bundle | Content-hashed same-origin file (`externalScripts: true`); routes sharing state share one file |
| Critical CSS swap | beasties' `media="print"` plus an inline `onload` handler | No swap handlers (`criticalCssPreload: false`); deferred stylesheets stay plain links |

```js
snappy({ csp: 'strict' });                            // the dial
snappy({ csp: 'strict', criticalCssPreload: 'media' }); // strict scripts, swap kept
snappy({ externalScripts: true });                    // fine-tune one part on its own
```

Two things the dial cannot remove, because they are what prerendered HTML is:

- Inlined CSS — critical CSS, `inlineCss: 'inline'`, and captured runtime styles — is `<style>` text, so `style-src` needs an allowance, the same as any prerendered HTML.
- The app bundle is an ordinary external script and is unaffected either way.

## Third-party requests

Third-party requests are allowed by default. Most React sites load content from a CMS, headless API or separate service origin; blocking those during prerendering produces pages without data. The default matches react-snap.

```js
snappy({ blockThirdParty: false });                    // default: allow all
snappy({ blockThirdParty: true });                     // abort third-party requests
snappy({ blockThirdParty: true, allowedHosts: ['cms.example.com'] }); // block all but the CMS
```

Blocking makes rendering deterministic and keeps analytics, ads and chat widgets from executing during a build. `allowedHosts` keeps a CMS API reachable while blocking everything else.

Preconnect hints are generated for every third-party origin the page contacts, including allowlisted hosts while blocking. Set `preconnectThirdParty: false` to disable them. The CLI equivalent for blocking is `--block-third-party`.

## CSS-in-JS

Emotion, styled-components, vanilla-extract, stitches and JSS work when their styles end up as text inside a `<style>` tag. Three cases need extra handling:

**CSSOM-only styles.** In production, emotion and styled-components v5 switch to `CSSStyleSheet.insertRule` ("speedy" mode), which puts rules in the CSS object model and leaves the style element empty in the DOM. Serialising the page would drop every one of those rules. `captureRuntimeStyles` (default `true`) copies them back into the element text, and also folds document-level constructable stylesheets (`document.adoptedStyleSheets`) into a `<style>` tag. Set it to `false` to leave stylesheets untouched.

**Blob-backed stylesheets.** Some setups create stylesheets as `blob:` URLs, which are dead once the page is gone. `removeBlobs` (default `true`) drops those links, and `inlineCss: 'inline'` inlines their content instead.

**Duplicate styles.** Runtimes that re-inject identical CSS during hydration leave repeated style tags behind. Identical `<style>` contents in the head are de-duplicated. A runtime may also re-insert its rules into a captured sheet on the client; that repeats identical CSS outside React's tree, so it changes nothing visually and cannot cause a hydration error.

Both `inlineCss` strategies work with CSS-in-JS output, and the hydration verifier is what catches a runtime that renders differently on the client than during prerender.

**Limitation:** content inside shadow roots is not part of `page.content()`, so a UI built on web components is captured as light DOM only. Use declarative shadow DOM or render those parts into the light DOM.

## Form state

Controlled inputs keep their state as DOM properties, which do not survive serialisation: a checkbox that is checked at runtime would come back unchecked, and a select would fall back to its first option, until the bundle hydrates. `captureFormState` (default `true`) writes `checked` and `selected` attributes to match the live DOM — the same thing React's own server rendering emits for controlled inputs — and clears the attributes when the property is false, so a stale default from the markup cannot leak through. Set it to `false` to leave form controls untouched.

`input.indeterminate` has no attribute and cannot be captured; restore it in the app after hydration if you rely on it.

## Async data and state

Hydration mismatches usually come from data that was present during prerender but missing on the client. Two mechanisms close that gap.

**Cached JSON.** With `cacheAjaxRequests: true`, every same-origin JSON response is captured and injected before the first script runs:

```js
snappy({ cacheAjaxRequests: true });
```

```js
// in your app, during hydration
const cached = window.snapStore?.['/api/items?page=2'];
if (cached) return cached;
return fetch('/api/items?page=2').then((response) => response.json());
```

`window.snapStore` is keyed by the request path, including its query string. Responses larger than `maxCachedBytes` (default 5 MiB) are skipped so one large endpoint cannot bloat every page.

**App state.** Define `window.snapSaveState` and whatever it returns is injected as globals before the first script:

```js
window.snapSaveState = () => ({ __APP_STATE__: store.getState() });
// becomes: window.__APP_STATE__ = {...}
```

Values are JSON-encoded with `<`, `>`, `/` and line separators escaped, so state data cannot break out of the script tag. Keys and values are both escaped.

## Screenshots

```js
snappy({ saveAs: 'png', destination: 'build/screenshots' });
```

`saveAs: 'png'` or `'jpeg'` captures a full-page screenshot per route instead of HTML (`index.png`, `about.png`, `blog/post.png`). Hydration verification is skipped, since there is no HTML to verify.

## Writing elsewhere

```js
snappy({ destination: 'build/prerendered' });
```

The built output is copied to the destination first, so assets sit beside the generated HTML, and the source directory stays untouched. A destination that already has files is reported before it is overwritten.

## A typical config file

```js
// snappy.config.js — picked up by the CLI automatically
export default {
  sourceDir: 'dist',
  metadata: {
    siteUrl: 'https://example.com',
    siteName: 'Example',
    titleTemplate: '%s | Example',
    defaultImage: '/share.png',
  },
  cacheAjaxRequests: true,
  preloadImages: true,
  inlineCss: 'critical',
  minifyHtml: true,
};
```

The config can also be an async function that returns the options. That is how routes get discovered from a CMS, a sitemap or a directory listing, without a separate prebuild script:

```js
// snappy.config.js
export default async function () {
  const response = await fetch('https://cms.example.com/api/posts?fields=slug');
  const posts = await response.json();
  return {
    sourceDir: 'dist',
    include: ['/', '/blog', ...posts.map((post) => `/blog/${post.slug}`)],
    metadata: { siteUrl: 'https://example.com', siteName: 'Example' },
  };
}
```

The function is awaited once per run, and whatever it returns must be a plain options object. If it throws, the CLI reports the reason and stops before rendering anything.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `sourceDir` | `dist` | Built output directory |
| `destination` | `null` | Copy the output here and write results here instead of in place |
| `cleanDestination` | `false` | Empty the destination before copying, so removed assets do not linger |
| `base` | `/` | Public base path |
| `include` | `['/']` | Seed routes and output allowlist. Wildcards (`/blog/*`) filter discovered routes, only concrete paths are seeded, and a seed that does not match the list is used for crawling but not written. Passing `['/']` is treated as the default: crawl everything linked from the root |
| `exclude` | `[]` | Routes to skip, strings or RegExp |
| `crawl` | `true` | Follow same-origin links from seeds |
| `maxDepth` | `null` | Crawl depth limit, `null` is unlimited, `0` renders seeds only |
| `maxRoutes` | `null` | Stop after this many routes; hitting the cap marks the run incomplete and lists the routes that did not fit in `truncated.droppedRoutes` |
| `routePriority` | `[]` | Patterns ranked first when crawling, strings or RegExp; setting it selects deterministic BFS |
| `routesFile` | `null` | Text or JSON route seeds, one route per line or `{ "routes": [] }`; a relative path resolves against the config file |
| `routesFromSitemap` | `null` | Local path or http(s) URL whose `<loc>` entries seed routes; sitemap indexes are followed one level, the public base is stripped from root-relative locs, and off-origin locs are ignored. Absolute locs in a local sitemap need `metadata.siteUrl` or a remote sitemap origin |
| `routeOverrides` | `[]` | Per-route `{ match, timeout, waitFor, readySelector, readyFlag, crawl, storageState, hydration }`; later entries win |
| `freezeTime` | `false` | `true`, an ISO string or epoch ms; fixes `Date`/`Date.now()` in render and verification. `true` uses `SOURCE_DATE_EPOCH` or the run start |
| `timezone` | `null` | IANA timezone applied to render and verification contexts |
| `randomSeed` | `null` | Deterministic `Math.random()` during render and verification; never for security |
| `hydration` | `{ allowRerender: [], skip: [] }` | Route patterns whose re-render is allowed or whose verification is skipped |
| `locales` | `null` | Locale matrix for path or single mode, automatic hreflang, canonical, `og:locale` and sitemap alternates |
| `seoLocale` | `null` | Optional cookie/localStorage locale seed and output bootstrap for SEO builds |
| `transformHtml` | `null` | Function `(html, { route, file, stats, config })` run before preload/CSP injection; may be async |
| `concurrency` | derived | Parallel pages, derived from CPU count, capped at 8 |
| `timeout` | `30000` | Navigation, ready and network-settle timeout in ms; each wait gets this budget |
| `quietPeriod` | `500` | Network must be idle this long before capture |
| `readyFlag` | `__prerenderReady` | Window flag awaited when defined |
| `readySelector` | `null` | Selector awaited when set |
| `waitFor` | `null` | Selector awaited on every route |
| `viewport` | `1280x720` | Browser viewport |
| `storageState` | `null` | Playwright storage state file for authenticated routes |
| `userAgent` | `SnappyPrerender` | User agent used while rendering, `null` for the browser default |
| `browser` | `auto` | `auto`, `chrome`, `msedge`, `chromium`, or a path to an executable |
| `browserDownload` | `true` | Allow the Chrome for Testing fallback download |
| `browserDownloadHash` | `null` | SHA-256 digest the fallback download must match, verified before use |
| `browserDownloadVersion` | `null` | Chrome for Testing build id to use for the cache and download instead of resolving `stable` |
| `browserArgs` | `[]` | Extra browser launch arguments |
| `headless` | `true` | Run the browser headless |
| `ignoreHTTPSErrors` | `false` | Ignore TLS errors while rendering |
| `blockThirdParty` | `false` | Allow third-party requests so CMS and API calls work; set `true` to abort them |
| `allowedHosts` | `[]` | Hosts kept reachable when `blockThirdParty` is on |
| `freezeAnimations` | `true` | Neutralise animations and emulate reduced motion |
| `scrollToBottom` | `false` | Scroll through pages to trigger lazy content |
| `scrollStepDelay` | `100` | Delay between scroll steps when `scrollToBottom` is on |
| `captureRuntimeStyles` | `true` | Fold CSSOM-only styles and constructable stylesheets into the output |
| `captureFormState` | `true` | Sync `checked` and `selected` into the output markup |
| `csp` | `'off'` | `'off'` leaves the injected pieces inline; `'strict'` makes the output work under `script-src 'self'` by moving state to a same-origin file and dropping the CSS swap handlers; `'hash'` adds a meta policy with SHA-256 hashes for inline scripts and styles |
| `inlineCss` | `false` | `'inline'`, `'critical'` (needs beasties) or `true` for `'inline'` |
| `criticalCssPreload` | `'media'` | Swap used for CSS deferred by `inlineCss: 'critical'`; `false` emits no swap handlers, for a strict script-src |
| `minifyHtml` | `false` | Minify output HTML, `true` for defaults or an html-minifier-terser options object |
| `minifyCss` | `false` | Minify CSS with clean-css, also applied to inlined CSS |
| `preconnectThirdParty` | `true` | Add preconnect hints for every third-party origin the page contacts |
| `preloadImages` | `false` | Add preload hints for same-origin images |
| `preloadManifest` | `false` | Write `preload-manifest.json` with Link header hints, derived from the final HTML |
| `preloadLinks` | `false` | Inject module, font and LCP image preload hints for static hosts; script hints are skipped when `removeScriptTags` is on |
| `ignoreForPreload` | `['service-worker.js']` | File names excluded from the manifest and injected hints |
| `sitemap` | `false` | Write `sitemap.xml` (or a sitemap index above 50,000 URLs) from the routes that do not declare noindex, and point an existing `robots.txt` at it; needs `metadata.siteUrl` |
| `imageSitemap` | `false` | List same-origin page images in the sitemap |
| `cacheAjaxRequests` | `false` | Expose captured JSON responses as `window.snapStore` |
| `maxCachedBytes` | `5242880` | Largest JSON response cached per request, measured on the serialised body |
| `removeBlobs` | `true` | Drop stylesheet links pointing at dead `blob:` URLs |
| `removeAttributes` | `[]` | Attribute names or RegExps to drop from the output, for libraries that stamp per-load ids |
| `stripBuildOriginMetadata` | `true` | Remove canonical and social tags whose URL points at the prerender server |
| `failOnBuildOriginMetadata` | `false` | Fail when metadata still points at the prerender server after stripping |
| `pruneStaleRoutes` | `false` | Delete pages listed by the previous run's manifest that this run no longer writes |
| `removeStyleTags` | `false` | Strip every style tag from the output; cannot be combined with `inlineCss` `'inline'` |
| `removeScriptTags` | `false` | Strip every script tag from the output |
| `asyncScriptTags` | `false` | Mark external scripts async |
| `externalScripts` | `false` | Write injected state scripts as content-hashed same-origin files instead of inline; set by `csp: 'strict'` or `'hash'` |
| `flatOutput` | `false` | Write `about.html` instead of `about/index.html` |
| `notFoundRoute` | `/404` | Route emitted as `404.html` with a robots noindex tag, even when the server answers HTTP 404; a notice is logged when it is never prerendered. A page can also declare `<meta name="prerender-status-code" content="404">` |
| `audit` | `true` | Check the written site for route health, broken links, metadata, sitemap and CSP issues |
| `failOnAuditError` | `false` | Fail when the audit finds an error |
| `auditIgnoreLinks` | `[]` | Link patterns excluded from the audit, strings or RegExp |
| `reportPath` | `null` | Write the versioned JSON run report to this file; URLs and the storage-state path are redacted |
| `saveAs` | `html` | `html`, `png` or `jpeg`; identical screenshots are left untouched |
| `metadata` | `null` | Defaults for the head component: `siteUrl` (origin only), `siteName`, `titleTemplate`, `defaultImage`, `trailingSlash`, `base` |
| `verify` | `true` | Run the hydration verification pass |
| `framework` | `auto` | `auto`, `react`, `vue`, `svelte` or `preact`; detects the mounted framework from DOM markers |
| `retries` | `0` | Retry a retryable render failure this many times |
| `retryDelay` | `500` | Wait between render attempts, in ms |
| `traceOnError` | `false` | Write a Playwright trace for the final failed attempt under `snappy-traces/` |
| `verifyChangedOnly` | `false` | Skip verification for routes whose HTML file did not change since the last run |
| `reuseVerificationContext` | `false` | Reuse one browser context per verification worker; routes share storage, so use only for stateless apps |
| `failOnHydrationError` | `false` | Fail the run on hydration errors; off by default, where they are reported instead |
| `failOnRerender` | `false` | Fail the run when a route re-renders instead of hydrating |
| `failOnPageError` | `false` | Fail the run when a page throws while rendering; off by default, where page errors are reported |
| `failOnEmptyPage` | `true` | Fail when a route renders no app content |
| `failOnConsoleError` | `false` | Fail when the browser logs a console error while rendering |
| `failOnFailedRequest` | `false` | Fail when a same-origin request fails while rendering |
| `failOnDuplicateContent` | `false` | Fail when two routes produce byte-identical HTML |
| `failOnUndetected` | `false` | Fail when verification cannot classify any route as hydrated or re-rendered |
| `failOnVerificationError` | `false` | Fail when the verification pass cannot run on a route |
| `failOnError` | `true` | Fail the run on route render errors |
| `dryRun` | `false` | Render and report without writing |
| `logLevel` | `info` | `silent`, `error`, `warn`, `info`, `debug` |
| `serveCmd` | `null` | Command that starts the app server instead of static serving |
| `url` | `null` | App origin, required with `serveCmd`; put a sub-path in `base` instead |
| `serveCmdTimeout` | `30000` | How long to wait for `serveCmd` to answer |
| `shutdownTimeout` | `5000` | Grace period before force-killing `serveCmd` |

Run `npx snappy-prerender --help` for the matching CLI flags.

## Programmatic API

```js
import { prerender } from 'snappy-prerender/core';

const report = await prerender({ sourceDir: 'dist', include: ['/'] });
if (!report.ok) {
  for (const failure of report.verification?.routes.filter((entry) => !entry.ok) ?? []) {
    console.error(failure.route, failure.hydrationErrors);
  }
  for (const failure of report.errors) console.error(failure.route, failure.message);
}
```

The report exposes `routes`, `files` (with per-route `status` and `noindex`), `routeDetails` (the per-route records used by the JSON report), `errors`, `pageErrors` (uncaught browser errors seen while rendering), `consoleErrors`, `failedRequests`, `emptyPages`, `duplicatePages`, `duplicateTitles` (routes shipping more than one title), `verification` (nullable; per-route `mode`, `framework`, `firstMismatch`, `status` and `empty` plus `modes` and `frameworks` summaries), `audit` (nullable; `errors`, `warnings`, `linksChecked`), `preloadManifest`, `sitemap`, `pruned`, `truncated`, `notFoundRoutes`, `cspSkipped`, `traces`, and `ok`. See [docs/report.md](docs/report.md) for the JSON schema.

`snappy-prerender` exports `DEFAULTS`, `prerender` and `resolveConfig`; the default export is the Vite plugin.

## Further reading

[Limitations](docs/limitations.md), [report schema and audit rules](docs/report.md), [migrating from react-snap](docs/react-snap-migration.md).

## Requirements
- Node.js >= 22.12
- Chrome or Edge installed (detected automatically), or allow the one-time Chrome for Testing download fallback
- `beasties` only if you use `inlineCss: 'critical'` (optional peer dependency)

Browser resolution order: installed Chrome, installed Edge, a Playwright-managed browser, a Chrome for Testing build already in the tool cache, then a Chrome for Testing download from Google's version-pinned HTTPS bucket into `SNAPPY_BROWSER_CACHE_DIR` (defaults to the platform cache directory). An explicit `browser` choice never falls back to another engine. Set `browserDownloadVersion` to pin the build id and `browserDownloadHash` to pin the archive digest; without a hash the download is trusted on the strength of HTTPS and the pinned URL. Set `browserDownload: false` to forbid downloads entirely.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, follow [SECURITY.md](SECURITY.md).

```sh
npm install
npm test               # unit
npm run test:integration
npm run lint
```

## License

MIT
