<p align="center">
  <img src="https://raw.githubusercontent.com/sayakmukherjee080/snappy-prerender/main/assets/snappy-logo.png" width="150" alt="snappy-prerender logo">
</p>

# snappy-prerender

**Static prerendering for existing single-page apps. MIT-licensed react-snap alternative.**

snappy-prerender turns a client-rendered build into one static HTML file per route. It runs after your normal build, opens each route in a browser, and writes the rendered page. The first response then contains the page content and metadata instead of an empty `<div id="root">`. The app still boots and hydrates as usual. It works with React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and plain JavaScript through a Vite plugin or CLI. No server renderer or framework migration is needed.

[![npm](https://img.shields.io/npm/v/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![npm downloads](https://img.shields.io/npm/dm/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![node](https://img.shields.io/node/v/snappy-prerender.svg)](https://www.npmjs.com/package/snappy-prerender)
[![license](https://img.shields.io/npm/l/snappy-prerender.svg)](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/LICENSE)

<a href="https://www.producthunt.com/products/snappy-prerender?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-snappy-prerender" target="_blank" rel="noopener noreferrer"><img alt="snappy-prerender - Turn your existing SPA into static HTML | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1297695&amp;theme=neutral&amp;t=1793431121819"></a>

**See it working:** the [before/after demo](https://github.com/sayakmukherjee080/snappy-prerender/tree/main/demo) builds the same app twice and shows what a crawler receives from each.

## Quick start

```sh
npm install --save-dev snappy-prerender
```

**Vite.** Add the plugin after your framework plugin. `vite build` then prerenders the output.

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import snappy from 'snappy-prerender';

export default defineConfig({
  plugins: [react(), snappy()],
});
```

**Any static build.** Point the CLI at the output directory.

```sh
npx snappy-prerender dist
```

**Create React App.** Run it after every build:

```json
{
  "scripts": {
    "build": "react-scripts build",
    "postbuild": "snappy-prerender build"
  }
}
```

**Guided setup.** `npx snappy-prerender init` detects Vite or Create React App, asks for routes, site URL and title template, and writes a `snappy.config.js` containing only the options you set.

A failed render fails the build. Hydration, audit and page errors are reported by default; enable their failure gates when you want them enforced.

## Coming from react-snap

Run `npx snappy-prerender init`. It reads the `reactSnap` block in `package.json`, maps the options, and reports ignored keys with a reason. Most options keep their names. A few are renamed for current browsers, such as `puppeteerArgs` to `browserArgs` and `http2PushManifest` to `preloadManifest`. The full mapping is in the [migration guide](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/react-snap-migration.md).

| | react-snap | snappy-prerender |
| --- | --- | --- |
| Last release | 1.23.0, December 2018 | Active |
| Browser | Puppeteer-era Chromium | Playwright with installed Chrome or Edge |
| Frameworks | React | React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember, plain JavaScript |
| React 18 and 19 | Open compatibility issue since 2023 | Supported |
| Boot check | No | Per route |
| Head and meta tags | External library or app code | Built in |
| Sitemap and `llms.txt` | No | Yes |
| License | MIT | MIT |

No react-snap code is reused.

## What you get

- **Static HTML per route.** `route/index.html` or `route.html`, plus `404.html`. Routes come from a list, links, a sitemap or a crawl.
- **Metadata in the first response.** Titles, descriptions, canonical URLs, Open Graph, Twitter cards and JSON-LD. React apps get `Head`; other frameworks call `setHead`. Site defaults live in one `metadata` block.
- **Discovery files.** A sitemap built from rendered routes, a sitemap line in `robots.txt`, and an optional `llms.txt` index.
- **Boot check.** Reloads each page with your bundle and reports hydrated, re-rendered or undetected, with per-route policies.
- **Deterministic output.** Frozen clock, time zone and seeded `Math.random` during the build.
- **Captured state.** Ajax responses, `window.snapSaveState()` data, CSS-in-JS styles and form values are written into the page.
- **Output tuning.** Critical CSS, HTML and CSS minification, preconnect and preload hints, a preload manifest, and strict or hash-based CSP.
- **Locales.** Path-prefixed or single-locale builds with `hreflang`, localized URLs and sitemap alternates.
- **Incremental builds.** Reuses unchanged routes and revalidates cached API responses and assets.
- **Audit and drift.** Reports broken links, metadata, sitemap and CSP issues, plus changes against a saved baseline.

## How it works

1. Serves the built output on a loopback port.
2. Opens each route in a fresh browser context and follows same-origin links when crawling.
3. Waits for `window.__prerenderReady`, a selector or network idle.
4. Saves the rendered DOM and cleans it up, optionally inlining CSS and minifying.
5. Writes each route's HTML file, plus discovery files when enabled.
6. Reloads each page with your bundle and reports how the app booted.

The renderer uses the `SnappyPrerender` user agent, so apps can skip analytics or change API hosts during the build.

## What crawlers and AI assistants see

Search and AI crawlers read the first HTML response. GPTBot, ClaudeBot and PerplexityBot do not guarantee JavaScript execution. Googlebot can render JavaScript, but only in a later pass. A client-rendered app returns an empty root to all of them.

After prerendering, each route's HTML includes the page text, title, description, canonical URL, Open Graph tags and any JSON-LD. Browsers still load the full app afterwards.

## Framework support

The test matrix builds the same multi-route site in every framework and prerenders it. It runs both the oldest and newest versions below.

| Framework | Oldest validated | Newest validated |
| --- | --- | --- |
| React | 16.8.0 | 19.2.0 |
| Vue | 3.0.0 | 3.5.44 |
| Svelte | 3.29.0 | 5.57.3 |
| Preact | 10.5.4 | 11.1.1 |
| Angular | 10.1.6 | 22.2.4 |
| Solid | 0.20.3 | 1.9.18 |
| Lit | lit-html 1.3.0 | 3.3.3 |
| Ember | 3.22.0 | 7.3.0 |
| Plain JavaScript | any | any |

React hydrates the prerendered markup, so boot checks report real mismatches. Vue and Preact client-only builds replace it on boot; those show as allowed re-renders. Solid needs `framework: 'solid'`; some older Svelte and Lit builds need the option too. Per-version results are in the [test matrix](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/testcase/README.md#validation-status).

CI also covers React 16.8 through 19.2 and Vite 6, 7 and 8.

## When not to use it

- Your app already renders HTML on the server: Next.js, Remix, Astro, Nuxt, SvelteKit or Angular Universal.
- The page depends on live per-request data or the logged-in user. Prerendered HTML is a build-time snapshot; leave those routes client-rendered or exclude them.
- You need different HTML per visitor. Use a server renderer for that.

## FAQ

### Is react-snap still maintained?

No. Its last npm release was 1.23.0 in December 2018, its last source commit was in October 2019, and its React 18 compatibility issue has been open since April 2023.

### Can I get SEO for a React app without Next.js or server-side rendering?

Yes. Prerendering gives search and AI crawlers full HTML for every route while the app stays a client-rendered SPA. It fits marketing pages, docs, blogs and CMS-backed content, but not pages that must differ per request.

### Do I need to change my app code?

Usually not. If data loads after the first render, set `window.__prerenderReady = true` or pass a `waitFor` selector. Time and random values are frozen during the build.

### What if a page fetches data from an API?

The data is fetched during the build and written into the HTML. With `cacheAjaxRequests`, responses are also written into the page so the client starts from the same data.

### Does it need Chrome?

It uses installed Chrome or Edge when available. Otherwise it downloads Chrome for Testing once and caches it. You can pin the version and hash, or disable downloads.

### How is this different from a prerendering service?

A prerendering service renders pages per request for bots on its own servers. snappy-prerender renders at build time and writes plain files that any static host serves. It needs no proxy, bot detection or vendor.

## Documentation

- [Configuration, options and API](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/configuration.md)
- [Head and metadata](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/head.md)
- [Rendering, readiness and hydration](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/hydration.md)
- [Output, assets and captured state](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/output.md)
- [Locales and hreflang](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/locales.md)
- [Audit, reports and content drift](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/audit.md)
- [Report schema and audit rules](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/report.md)
- [Migrating from react-snap](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/react-snap-migration.md)
- [Limitations](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/limitations.md)
- [Changelog](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/CHANGELOG.md)

## Requirements

- Node.js 22.12 or later
- Chrome or Edge installed, or permission for a one-time Chrome for Testing download
- `beasties`, only if you use `inlineCss: 'critical'`

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/CONTRIBUTING.md). Report security issues as described in [SECURITY.md](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/SECURITY.md).

```sh
npm install
npm test
npm run test:integration
npm run lint
```

## License

MIT
