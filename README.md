# snappy-prerender

**Prerender your single-page app without rewriting it.** Point it at your build output, and every route is rendered in a real browser and written to disk as static HTML — content, titles, meta tags, canonical links and Open Graph tags included. Search engines and social crawlers get the full page; your users get the same app they had before.

[![npm](https://img.shields.io/npm/v/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![npm downloads](https://img.shields.io/npm/dm/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![node](https://img.shields.io/node/v/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![license](https://img.shields.io/npm/l/snappy-prerender.svg)](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/LICENSE)

Package page: [npmjs.com/package/snappy-prerender](https://www.npmjs.com/package/snappy-prerender). Install with `npm install --save-dev snappy-prerender`. Release notes are in [CHANGELOG.md](CHANGELOG.md).

- **No SSR entry, no framework migration, no app changes.** If it builds to a `dist` directory, it can be prerendered.
- **React 16.8, 17, 18 and 19, Vite 6/7/8, or any static build.**
- **Inspired by [react-snap](https://github.com/stereobooster/react-snap)** and rebuilt from scratch for current toolchains: a browser-based prerenderer with a hydration report attached, not another SSR framework.

## Who this is for

**Use it when** your app renders in the browser and you want the crawler-visible HTML to match: Create React App, Vite + React, plain SPAs, CMS-driven sites, marketing pages behind a client router.

**Skip it when** you already render HTML on the server — Next.js, Remix, Astro and friends do not need prerendering, and this tool will not improve on what they ship.

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

## Inspired by react-snap

react-snap proved the idea that makes this approach attractive: you do not need a server, a second renderer or a rewrite to give crawlers real HTML — you need a browser, a router and a build step. It carried a generation of webpack-era SPAs and has been unmaintained since 2019.

`snappy-prerender` is a fresh implementation of that idea for current toolchains. It is not a fork: no react-snap code was reused. What changed is the machinery around the same core trick — Playwright instead of an old Puppeteer, Chrome or Edge from the machine you already have, Vite plugin support, a head and metadata layer with client-side updates, hydration verification that tells you how each page booted, and option names that say what they do.

If you are moving over, [Migrating from react-snap](docs/react-snap-migration.md) maps every option.

## What you get

| | |
| --- | --- |
| **Static HTML per route** | `route/index.html` (or `route.html` with `flatOutput`), plus a `404.html` from your not-found route. Identical files are left untouched, so rebuilds and CI caches stay stable. |
| **Head and metadata** | A `Head` component writes per-route title, description, robots, canonical, Open Graph and Twitter tags — and keeps updating them on client-side navigation, exactly like a page-per-request site. |
| **Hydration report** | Every written page is reloaded with the real bundle and reported as `hydrated`, `re-rendered`, `undetected` or `unknown`, with React mismatch messages per route. |
| **A ready contract** | `window.__prerenderReady`, a selector, or network quiescence — whichever fits your app. |
| **Output optimisation** | Critical CSS, HTML/CSS minification, preconnect hints, image preload, a preload manifest, script and style surgery. |
| **CSS-in-JS support** | CSSOM-only styles (emotion, styled-components in speedy mode) and constructable stylesheets are folded back into the HTML. |
| **Ajax state replay** | Captured JSON and `window.snapSaveState()` are injected before the first script, so hydration sees the same data the prerender did. |
| **Guided setup** | `snappy-prerender init` asks the handful of questions that matter — build directory, base path, routes, site URL, site name, title template — and writes a `snappy.config.js` with your answers, detected from the project where it can. |
| **Any static build** | Base paths, `serveCmd` for apps that need a live API, screenshots, dry runs, bounded concurrency. |

## How it works

1. Serves the built output on an ephemeral loopback port (or copies it to `destination` first).
2. Crawls same-origin links from the seed routes, rendering each page in a fresh browser context.
3. Waits for the app to settle: ready contract, quiet network, fonts, two animation frames.
4. Freezes CSS animations, optionally blocks third-party requests, records the resources the page used, and reconciles any head tags the app rendered.
5. Serialises the DOM, then post-processes it: removes the freeze style and `data-prerender-remove` elements, de-duplicates head styles, drops dead blob stylesheets, adds link hints, optionally inlines CSS, removes or marks scripts, optionally minifies, and notes metadata that points at the build server or ships more than one title.
6. Writes `route/index.html` (or a screenshot), leaving identical files untouched.
7. Reloads every written file with the real client bundle, reports React hydration errors, and records whether each route hydrated or re-rendered.

## Head and metadata

Per-route titles, descriptions, canonical links and Open Graph/Twitter tags come from a `Head` component the package ships. It writes into the document head while the route is mounted and reconciles on every render, so client-side navigation updates the head exactly like a site that renders a page per request — and the prerenderer captures whatever is there, because the head is part of the page it serialises.

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

Project-wide values come from the `metadata` option. The prerenderer injects them into every page, so the component composes absolute URLs from the public site rather than the build server:

```js
snappy({
  metadata: {
    siteUrl: 'https://example.com',
    siteName: 'Example',
    titleTemplate: '%s | Example',
    defaultImage: '/share.png',
    trailingSlash: 'never', // 'preserve' | 'always' | 'never'
  },
});
```

What it emits, per route: `title` (with the template applied unless the title already carries its suffix), `meta[name=description]`, `meta[name=robots]`, `link[rel=canonical]`, `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`, `og:locale`, and `twitter:card` / `twitter:title` / `twitter:description` / `twitter:image`. Switch a family off with `openGraph: false` or `twitter: false`, and skip the canonical with `canonical: false`.

Rules worth knowing:

- `metadata` values are defaults; a `Head`'s own props win. When several Heads render, the later one in render order wins per tag, so a page overrides its layout.
- Tags are matched on the attribute a crawler reads, so an existing tag is updated in place rather than duplicated. Two tags with the same identity already in the document — a `name`, `property`, `http-equiv` or `rel` match — are reduced to one.
- A tag the head layer generated carries `data-snappy-head-created` beside `data-snappy-head`, so a later page load can tell it apart from one the app wrote.
- When no Head wants a tag any more, a generated one is removed and one the app wrote is restored to the value it had before the head layer touched it. That original is recorded into the page during prerendering, so a route change brings the template's fallback metadata back.
- The component renders nothing, so it cannot affect hydration of the page content.
- The title template applies unless the title already ends with the template's fixed part, or is the site name itself, so a title composed by hand is never suffixed twice.
- `structuredData` emits `<script type="application/ld+json">` for one object or an array of objects, keyed per mounted `Head` so a layout and a page can each contribute a block. Values are escaped so they cannot close the script element; add `@context` yourself when you want one.
- `lang` and `dir` are written on `<html>`, not in the head. Later Heads win, and the original values return when no Head wants them any more.
- `alternates` emits `<link rel="alternate" hreflang="...">` with absolute URLs through the same `siteUrl`/`base`/`trailingSlash` policy as canonical links. The same alternates feed `xhtml:link` entries in the sitemap.
- Absolute URLs are required for `og:url`, `og:image` and canonical. `metadata.siteUrl` must be an origin (no path); put a sub-path deployment in `base`. Without `siteUrl`, URLs that fall back to the build server are removed from the output by default (`stripBuildOriginMetadata: true`) and the run warns. The `trailingSlash` convention applies to page URLs only; asset URLs are left alone. Canonical, social and sitemap URLs share one page-path policy: directory output keeps its slash, flat output stays extensionless, and an explicit `trailingSlash` wins.
- `metadata.base` overrides the base path used for absolute URLs and defaults to the `base` option.
- On React 19, React hoists `<title>` and `<meta>` rendered in JSX and leaves an existing template tag alone, so a page can end up with two titles. Use React's native metadata or this component, not both; the run warns when the output carries more than one `<title>`.
- Every metadata value has a CLI flag: `--metadata-site-url`, `--metadata-site-name`, `--metadata-title-template`, `--metadata-default-image`, `--metadata-trailing-slash`.
- `react` is an optional peer dependency, needed only for this entry point. Non-React code can call `setHead(id, props)` and `clearHead(id)` instead.

## Audit, reports and route sources

The run audits the written site by default: route errors and truncation, empty or duplicate output, broken internal links, duplicate or missing metadata, sitemap disagreement and orphan pages. Findings are logged, returned in `report.audit`, and reported without failing the build; set `failOnAuditError: true` to make an audit error fail the run. `auditIgnoreLinks` excludes known dynamic links, and `--no-audit` skips the pass. The full rule list and the JSON schema are in [docs/report.md](docs/report.md).

`reportPath` (CLI `--report`) writes that report as versioned JSON. It never contains configuration, storage state, captured AJAX data, cookies or tokens; URLs are reduced to their origin and path, and the configured storage-state path is redacted.

Routes can come from `include` and crawling, from a text/JSON `routesFile`, or from a local or remote sitemap via `routesFromSitemap`. A relative source path resolves against the config file. Root-relative sitemap locations have the public base stripped, and a remote sitemap's off-origin locations are ignored. When either source is supplied and `include` was not set, the root is not seeded implicitly. With `maxRoutes` or `routePriority` set, crawling runs in deterministic breadth-first waves: each level is sorted by priority then path, capped, and rendered, so the accepted set and `truncated.droppedRoutes` do not depend on concurrency.

`routeOverrides` applies `timeout`, `waitFor`, `readySelector`, `readyFlag`, `crawl` and `storageState` to matching routes; later entries win per key. `transformHtml` runs once per route after minification and before preload/CSP injection, and may be async; it must return a string or nothing.

`preloadLinks` injects `<link rel="modulepreload">` for runtime chunks, font preloads with their captured content type, and the LCP image. It complements `preloadManifest`: the manifest is for hosts that can send Early Hints, while the injected links work on any static host. Script hints are skipped when `removeScriptTags` is on.

`csp: 'hash'` adds a `<meta http-equiv="Content-Security-Policy">` with SHA-256 hashes for inline scripts and styles. It implies `externalScripts: true` and no CSS swap handler, like `strict`. The policy allows `'self'` only, so third-party scripts or styles need your own policy; the audit warns when the browser reports a blocked request. An existing CSP meta is kept and reported instead of merged. Inline `style=""` attributes and event handlers cannot be hashed; the audit warns about the attributes.

## Hydration verification

After writing the output, every route is loaded again with the real client bundle in a fresh browser context. The pass reports two things, and by default neither fails the build: the static HTML that crawlers read is already written and is unaffected by what the client does afterwards. Set `failOnHydrationError: true` (or pass `--fail-on-hydration-error`) when you want hydration treated as a build gate.

**Hydration errors.** Mismatch messages for React, Vue, Svelte and Preact are reported with the route, framework and message. React's text mismatches and minified production codes (`#418`, `#423`, `#425`) are recognised, and Preact reuses the React-compatible messages. They mean the client re-renders that page instead of adopting the markup, which costs the user some work on load but leaves the static output — search engines and social crawlers still read the prerendered HTML. Enforce them with `failOnHydrationError: true` when you want the stricter gate.

The framework is detected from DOM markers only (`__reactContainer`, `__vue_app__`/`__vue__`, `__k`, `data-svelte-h`), so nothing is imported or executed. Set `framework` when a custom root defeats detection. When a route has hydration errors or re-rendered, `firstMismatch` locates the first difference between the written HTML and the live container: `{ path, kind, expected, actual }`, bounded to 5,000 nodes and depth 20.

A probe installed before the app's scripts run remembers the first prerendered node and checks whether it survived:

| Mode | Meaning |
| --- | --- |
| `hydrated` | The app adopted the prerendered markup, which is the goal. |
| `re-rendered` | The app discarded it and rendered from scratch. |
| `undetected` | No framework root was found on the container, so the mode could not be judged. |
| `unknown` | The prerendered node was never seen, for example a container outside the usual ids. |

A route whose verification navigation returns HTTP 4xx/5xx, or whose container renders no content, is reported as failed with its `status` or `empty` flag. `undetected` and `unknown` are reported as mode counts; set `failOnUndetected: true` to make any such route fail the build. A verification pass that cannot run is listed in `verification.errors`; set `failOnVerificationError: true` to fail on those separately from hydration errors.

`re-rendered` matters because an app calling `createRoot` instead of `hydrateRoot` throws the prerendered DOM away on boot — and because `createRoot` cannot raise a hydration error, nothing else would ever tell you. It is reported per route as `verification.routes[].mode` and summarised in `verification.modes`, with a warning in the log. Set `failOnRerender: true` to make it fail the build as well.

**Page errors.** Errors the browser logs while verifying are reported too: uncaught exceptions as warnings, console errors at debug level. Errors thrown during rendering itself are counted in the summary and reported per route, and `failOnPageError: true` turns them into a build failure; by default an app that throws still ships what it managed to render, because the static output is what crawlers read.

**React 16 and 17.** Hydration and boot modes are judged the same way, and their dev mismatch warnings ("Text content did not match", "Did not expect server HTML to contain") are recognised. Their production builds report nothing for a mismatch at all — no warning, no minified code — so on 16 and 17 the boot-mode report (`hydrated` versus `re-rendered`) is the signal that something drifted.

**Rebuilds.** On a large site most routes are unchanged between builds, and reloading them proves nothing new. `verifyChangedOnly: true` skips the verification pass for routes whose HTML file was left untouched, which roughly halves rebuild time; the report notes how many routes were skipped, and the first run after a change still verifies everything that moved.

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

It inlines the critical CSS and converts the remaining stylesheets to non-blocking loads using `media="print"` plus an inline `onload` handler, with a `<noscript>` fallback. Note that the inline handler is inline JavaScript: a strict `script-src` CSP without `unsafe-inline` will leave the deferred stylesheets unapplied. In that case use `'inline'` or a nonce-aware setup.

### Minification

```js
snappy({ minifyHtml: true, minifyCss: true });
```

`minifyHtml` uses html-minifier-terser with react-snap's defaults (whitespace collapsing, boolean attribute collapsing, attribute sorting). **Whitespace collapsing changes text nodes, which React notices during hydration** — the verifier is your safety net, and `{ collapseWhitespace: false }` is the usual fix. `minifyCss` is passed through to clean-css and also minifies CSS inlined into the HTML.

### Link hints

```js
snappy({ preconnectThirdParty: true, preloadImages: true, preloadManifest: true });
```

- `preconnectThirdParty` (default `true`) records every third-party origin the page tried to reach — including ones blocked by `blockThirdParty` — and adds `<link rel="preconnect">` for each.
- `preloadImages` adds `<link rel="preload" as="image">` for same-origin images the page loaded.
- `preloadManifest` writes `preload-manifest.json` into the output directory: for each route, a `Link` header value listing the scripts and stylesheets the final HTML still references, filtered by `ignoreForPreload` (default `['service-worker.js']`). Inline CSS and tag surgery are already reflected, the not-found route is omitted, and hints and route keys carry the base path, so serve these as Early Hints or `Link` response headers as they are.

react-snap called this `http2PushManifest`. Browsers removed HTTP/2 push (Chrome in v106), so the manifest is now a header list rather than a push list.

### Sitemap

```js
snappy({ sitemap: true, metadata: { siteUrl: 'https://example.com' } });
```

`snappy` already knows every route it rendered, so it can write the sitemap for you. `sitemap.xml` is generated from the routes that were written — using the same page path policy as canonical URLs, with the base path applied, `noindex` pages and the not-found route left out — and split behind a sitemap index when it exceeds 50,000 URLs. Entries carry no `<lastmod>`, because a build date would claim every page changed on every build.

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

The persisted metadata element is exempt from `removeScriptTags`; everything else is removed as asked.

### Removing volatile markup

Mark any element with `data-prerender-remove` and it is dropped from the output:

```jsx
<div data-prerender-remove>{ads.render()}</div>
```

Use it for regions that only make sense after the client takes over — ads, chat widgets, anything injected after mount. The rule of thumb: remove markup that React will *not* render on its first client pass. Removing something React does expect causes the very hydration mismatch it was meant to avoid, which is exactly what the verifier would then report.

Some libraries stamp values that change on every page load — antd's `rc-menu` writes `data-menu-id="rc-menu-uuid-…"` — which makes every rebuild rewrite every file and leaves `verifyChangedOnly` nothing to skip. List those attribute names (or RegExps) and they are dropped from the output:

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

Third-party requests are **allowed by default**. Most React sites get their content from a CMS, headless API or a separate service origin, and blocking those during prerendering produces pages that render without data — so the default keeps them working, matching react-snap.

```js
snappy({ blockThirdParty: false });                    // default: allow everything
snappy({ blockThirdParty: true });                     // abort every third-party request
snappy({ blockThirdParty: true, allowedHosts: ['cms.example.com'] }); // block all but the CMS
```

Turning blocking on makes rendering deterministic and keeps analytics, ads and chat widgets from executing during a build. `allowedHosts` is the usual setting for a CMS-backed site: the API stays reachable while everything else is cut.

Preconnect hints are generated for **every** third-party origin the page contacts — including hosts you allowlist while blocking — so the deployed page can start those connections early. Set `preconnectThirdParty: false` to turn the hints off. The CLI equivalent for blocking is `--block-third-party`.

## CSS-in-JS

Emotion, styled-components, vanilla-extract, stitches, JSS and friends work out of the box as long as their styles end up as text inside a `<style>` tag. Three things need more than plain serialisation:

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

`window.snapStore` is keyed by the request path (including its query string), exactly as your app requested it. Responses larger than `maxCachedBytes` (default 5 MiB) are skipped, so one heavy endpoint cannot bloat every page.

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
| `routeOverrides` | `[]` | Per-route `{ match, timeout, waitFor, readySelector, readyFlag, crawl, storageState }`; later entries win |
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

- [Limitations](docs/limitations.md)
- [Report schema and audit rules](docs/report.md)
- [Migrating from react-snap](docs/react-snap-migration.md)

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
