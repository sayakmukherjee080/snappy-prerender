# snappy-prerender

Drop-in prerendering for existing single-page apps. It serves your built output, renders every route in a real browser, writes static HTML per route, and then reloads each page with your client bundle to prove React hydration still succeeds.

No SSR entry, no framework migration, no app changes. React 18 and React 19, Vite 6/7/8, or any static build directory.

## Why

Search engines and social crawlers still read HTML, not client-rendered DOM. `react-snap` solved this for webpack-era SPAs and has been unmaintained since 2019, leaving React 18 hydration mismatches to be discovered in production. `snappy-prerender` is a fresh implementation for current toolchains with the missing piece built in: **hydration verification**. If the prerendered HTML does not hydrate cleanly, the build fails with the exact route and React error.

## Requirements

- Node.js >= 20.19
- Chrome or Edge installed (detected automatically), or allow the one-time Chrome for Testing download fallback

Browser resolution order: installed Chrome, installed Edge, a Playwright-managed browser, then a Chrome for Testing download from Google's version-pinned HTTPS bucket into `SNAPPY_BROWSER_CACHE_DIR` (defaults to the platform cache directory). Chrome for Testing publishes no checksum feed, so that archive is trusted on the strength of HTTPS and the pinned URL rather than a verified hash. Set `browserDownload: false` to forbid downloads entirely.

## Install

```sh
npm install --save-dev snappy-prerender
```

## Vite plugin

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import snappy from 'snappy-prerender';

export default defineConfig({
  plugins: [react(), snappy()],
});
```

`vite build` now prerenders the output directory. Rendering or hydration failures fail the build.

## CLI

For any static output directory, Vite or not:

```sh
npx snappy-prerender dist
npx snappy-prerender dist --include /,/pricing,/blog/* --exclude /blog/drafts/*
```

## How it works

1. Serves the built output on an ephemeral loopback port.
2. Crawls same-origin links from the seed routes, rendering each page in a fresh browser context.
3. Waits for the app to settle: ready contract, quiet network, fonts, two animation frames.
4. Freezes CSS animations and third-party requests so output is deterministic.
5. Serialises the DOM, strips the freeze style, removes elements marked `data-prerender-remove`, de-duplicates head styles, and writes `route/index.html`.
6. Reloads every written file with the real client bundle and reports React hydration errors.

Identical output files are left untouched, so rebuilds stay cache-friendly.

## Ready contract

Most apps work with no configuration because the network-quiet heuristic is enough. Apps that fetch data after load can opt into a stronger signal:

```js
// early in your app
window.__prerenderReady = false;
// when data has rendered
window.__prerenderReady = true;
```

The flag is only awaited when the app defines it. Alternatively use `waitFor` (a selector that must appear on every route) or `readySelector`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `sourceDir` | `dist` | Built output directory |
| `base` | `/` | Public base path |
| `include` | `['/']` | Seed routes and allowlist. Wildcards (`/blog/*`) filter discovered routes, only concrete paths are seeded |
| `exclude` | `[]` | Routes to skip, strings or RegExp |
| `crawl` | `true` | Follow same-origin links from seeds |
| `maxDepth` | `null` | Crawl depth limit, `null` is unlimited, `0` renders seeds only |
| `concurrency` | derived | Parallel pages, derived from CPU count, capped at 8 |
| `timeout` | `30000` | Per-route timeout in ms |
| `quietPeriod` | `500` | Network must be idle this long before capture |
| `scrollStepDelay` | `100` | Delay between scroll steps when `scrollToBottom` is on |
| `readyFlag` | `__prerenderReady` | Window flag awaited when defined |
| `readySelector` | `null` | Selector awaited when set |
| `waitFor` | `null` | Selector awaited on every route |
| `viewport` | `1280x720` | Browser viewport |
| `storageState` | `null` | Playwright storage state file for authenticated routes |
| `browser` | `auto` | `auto`, `chrome`, `msedge`, `chromium`, or a path to an executable |
| `browserDownload` | `true` | Allow the Chrome for Testing fallback download |
| `blockThirdParty` | `true` | Abort third-party requests during rendering and verification |
| `allowedHosts` | `[]` | Extra hosts allowed when third-party blocking is on |
| `freezeAnimations` | `true` | Neutralise animations and emulate reduced motion |
| `scrollToBottom` | `false` | Scroll through pages to trigger lazy content |
| `flatOutput` | `false` | Write `about.html` instead of `about/index.html` |
| `notFoundRoute` | `/404` | Route emitted as `404.html` |
| `verify` | `true` | Run the hydration verification pass |
| `failOnHydrationError` | `true` | Fail the run on hydration errors |
| `failOnError` | `true` | Fail the run on route render errors |
| `dryRun` | `false` | Render and report without writing |
| `logLevel` | `info` | `silent`, `error`, `warn`, `info`, `debug` |
| `serveCmd` | `null` | Command that starts the app server instead of static serving |
| `url` | `null` | App URL, required with `serveCmd` |
| `serveCmdTimeout` | `30000` | How long to wait for `serveCmd` to answer |
| `shutdownTimeout` | `5000` | Grace period before force-killing `serveCmd` |

## Programmatic API

```js
import { prerender } from 'snappy-prerender/core';

const report = await prerender({ sourceDir: 'dist', include: ['/'] });
if (!report.ok) {
  for (const failure of report.verification.routes.filter((entry) => !entry.ok)) {
    console.error(failure.route, failure.hydrationErrors);
  }
}
```

The report exposes `routes`, `files` (with per-route `status`), `errors`, `pageErrors` (uncaught browser errors seen while rendering), `verification`, and `ok`.

## Limitations

- **Build-time data is a snapshot.** Anything fetched during rendering is frozen into the HTML until the next build.
- **Hydration mismatches are your app's to fix.** The verifier tells you exactly which route and which React error. Common causes: `Date.now()`, `Math.random()`, `localStorage` reads during render, viewport-dependent markup, and CSS-in-JS that re-injects styles on hydration.
- **Authenticated routes need `storageState`.** Never prerender personal data into static HTML without deciding to.
- **Runtime-only routes** (heavy API dependence, real-time data) are better served by `serveCmd` or left client-rendered.
- Route query strings are ignored; routes are deduplicated without them.

## License

MIT
