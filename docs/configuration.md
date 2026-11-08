# Configuration, options and API

`snappy-prerender` accepts a plain options object or an async function that returns one. The CLI loads `snappy.config.js` automatically.

```js
// snappy.config.js
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

An async config can fetch route lists from a CMS, sitemap or directory listing:

```js
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

The function runs once per build. If it throws, the CLI stops before rendering.

## Build and output

| Option | Default | Description |
| --- | --- | --- |
| `sourceDir` | `dist` | Build output directory |
| `destination` | `null` | Copy the build here and write output here |
| `cleanDestination` | `false` | Empty the destination before copying |
| `base` | `/` | Public base path |
| `flatOutput` | `false` | Write `about.html` instead of `about/index.html` |
| `notFoundRoute` | `/404` | Route written as `404.html` with noindex |
| `pruneStaleRoutes` | `false` | Delete pages from the previous run that are no longer written |
| `saveAs` | `html` | `html`, `png` or `jpeg` |
| `dryRun` | `false` | Render and report without writing |
| `reportPath` | `null` | Write the JSON run report here |
| `logLevel` | `info` | `silent`, `error`, `warn`, `info` or `debug` |

## Routes

| Option | Default | Description |
| --- | --- | --- |
| `include` | `['/']` | Seed routes and output allowlist. Wildcards filter discovered routes; `['/']` crawls from the root |
| `exclude` | `[]` | Routes to skip. Strings or RegExp |
| `crawl` | `true` | Follow same-origin links from seeds |
| `maxDepth` | `null` | Crawl depth. `null` is unlimited, `0` renders seeds only |
| `maxRoutes` | `null` | Stop after this many routes and record dropped routes |
| `routePriority` | `[]` | Patterns ranked first. Enables deterministic BFS |
| `routesFile` | `null` | Text or JSON route seeds. Relative paths resolve from the config file |
| `routesFromSitemap` | `null` | Local path or URL whose `<loc>` entries seed routes |
| `routeOverrides` | `[]` | Per-route overrides for timeout, readiness, crawl, storage state, hydration, framework and incremental reuse |

## Rendering

| Option | Default | Description |
| --- | --- | --- |
| `freezeTime` | `false` | Fix `Date` and `Date.now()`. `true` uses `SOURCE_DATE_EPOCH` or run start; accepts ISO string or epoch ms |
| `timezone` | `null` | IANA timezone for render and verification |
| `randomSeed` | `null` | Seed `Math.random()` during render and verification. Not for security |
| `concurrency` | derived | Parallel pages. Derived from CPU count, capped at 8 |
| `timeout` | `30000` | Timeout for navigation, readiness and network idle, in ms |
| `quietPeriod` | `500` | Network idle time before capture, in ms |
| `readyFlag` | `__prerenderReady` | Window flag to await |
| `readySelector` | `null` | Selector to await |
| `waitFor` | `null` | Selector awaited on every route |
| `viewport` | `1280x720` | Browser viewport |
| `storageState` | `null` | Playwright storage state file for authenticated routes |
| `userAgent` | `SnappyPrerender` | Rendering user agent. `null` uses the browser default |
| `browser` | `auto` | `auto`, `chrome`, `msedge`, `chromium` or an executable path |
| `browserDownload` | `true` | Allow the Chrome for Testing fallback download |
| `browserDownloadHash` | `null` | SHA-256 digest for the fallback download |
| `browserDownloadVersion` | `null` | Chrome for Testing build id |
| `browserArgs` | `[]` | Extra browser launch arguments |
| `headless` | `true` | Run headless |
| `ignoreHTTPSErrors` | `false` | Ignore TLS errors while rendering |
| `blockThirdParty` | `false` | Abort third-party requests. Leave off for CMS and API data |
| `allowedHosts` | `[]` | Hosts kept reachable when `blockThirdParty` is on |
| `freezeAnimations` | `true` | Disable animations and emulate reduced motion |
| `scrollToBottom` | `false` | Scroll pages to trigger lazy content |
| `scrollStepDelay` | `100` | Delay between scroll steps, in ms |
| `container` | `null` | App root selector. Fails if it matches nothing |
| `serveCmd` | `null` | Command that starts the app server |
| `url` | `null` | App origin for `serveCmd`. Use `base` for a subpath |
| `serveCmdTimeout` | `30000` | Wait for `serveCmd` to answer, in ms |
| `shutdownTimeout` | `5000` | Grace period before killing `serveCmd`, in ms |

## Capture and output

| Option | Default | Description |
| --- | --- | --- |
| `transformHtml` | `null` | Function run before preload and CSP injection. May be async |
| `captureRuntimeStyles` | `true` | Copy CSSOM-only and constructable styles into output |
| `captureFormState` | `true` | Sync `checked` and `selected` state into markup |
| `cacheAjaxRequests` | `false` | Expose captured JSON as `window.snapStore` |
| `maxCachedBytes` | `5242880` | Largest JSON response cached per request |
| `removeBlobs` | `true` | Remove dead `blob:` stylesheet links |
| `removeAttributes` | `[]` | Attribute names or RegExp to drop |
| `removeStyleTags` | `false` | Remove all style tags. Incompatible with `inlineCss: 'inline'` |
| `removeScriptTags` | `false` | Remove all script tags |
| `asyncScriptTags` | `false` | Mark external scripts async |
| `externalScripts` | `false` | Write injected state scripts as same-origin files. Implied by strict or hash CSP |
| `stripBuildOriginMetadata` | `true` | Remove canonical and social tags pointing at the prerender server |

## Output optimisation

| Option | Default | Description |
| --- | --- | --- |
| `inlineCss` | `false` | `inline`, `critical` (needs beasties), or `true` for inline |
| `criticalCssPreload` | `media` | Preload mode for critical CSS. `false` disables swap handlers |
| `csp` | `off` | `off`, `strict` for `script-src 'self'`, or `hash` for a meta policy with inline hashes |
| `minifyHtml` | `false` | Minify HTML. Accepts boolean or html-minifier-terser options |
| `minifyCss` | `false` | Minify CSS with clean-css, including inlined CSS |
| `preconnectThirdParty` | `true` | Add preconnect hints for third-party origins |
| `preloadImages` | `false` | Preload same-origin images |
| `preloadLinks` | `false` | Inject module, font and LCP image hints |
| `preloadManifest` | `false` | Write `preload-manifest.json` with Link headers |
| `ignoreForPreload` | `['service-worker.js']` | Files excluded from preload hints and manifest |

## Incremental builds and assets

| Option | Default | Description |
| --- | --- | --- |
| `incremental` | `false` | Reuse unchanged routes. `true` or `revalidate` checks API and assets; `trust` skips checks. Object accepts `enabled`, `mode`, `cachePath`, `maxAge`, `lockTimeout`, `exclude` and `data` |
| `vendorAssets` | `false` | Download allowlisted CSS, fonts, images and scripts into `snappy-assets`. Object accepts `hosts`, `types`, `maxBytes`, `onError` and `failOnExternalAssets` |

## SEO and discovery

| Option | Default | Description |
| --- | --- | --- |
| `metadata` | `null` | Site defaults: `siteUrl`, `siteName`, `titleTemplate`, `defaultImage`, `trailingSlash`, `base` |
| `locales` | `null` | Locale matrix for path or single mode, hreflang, canonical, `og:locale` and sitemap alternates |
| `seoLocale` | `null` | Cookie or localStorage locale seed and output bootstrap |
| `sitemap` | `false` | Write `sitemap.xml` from indexable routes and add it to `robots.txt`. Needs `metadata.siteUrl` |
| `imageSitemap` | `false` | Add same-origin page images to the sitemap |
| `llmsTxt` | `false` | Write `llms.txt`. `true` uses defaults, or pass `file`, `title`, `description`, `include`, `exclude`, `maxRoutes` |
| `sitemapLastmod` | `false` | Add `lastmod` from the drift baseline. Requires `drift` and `sitemap` |

## Verification

| Option | Default | Description |
| --- | --- | --- |
| `verify` | `true` | Run the hydration check |
| `framework` | `auto` | `auto`, `react`, `vue`, `preact`, `svelte`, `angular`, `solid`, `lit` or `ember`. Solid must be explicit |
| `hydration` | `{ allowRerender: [], skip: [] }` | Route patterns allowed to re-render or skipped during verification |
| `verifyChangedOnly` | `false` | Skip verification when the HTML file did not change |
| `reuseVerificationContext` | `false` | Reuse one browser context per worker. Only for stateless apps |
| `retries` | `0` | Retry retryable render failures |
| `retryDelay` | `500` | Delay between retries, in ms |
| `traceOnError` | `false` | Write a Playwright trace for the final failed attempt |

## Failure gates

| Option | Default | Description |
| --- | --- | --- |
| `failOnError` | `true` | Fail on route render errors |
| `failOnPageError` | `false` | Fail on uncaught page errors |
| `failOnEmptyPage` | `true` | Fail when a route has no app content |
| `failOnConsoleError` | `false` | Fail on browser console errors |
| `failOnFailedRequest` | `false` | Fail on same-origin request failures |
| `failOnDuplicateContent` | `false` | Fail when two routes produce identical HTML |
| `failOnHydrationError` | `false` | Fail on hydration errors |
| `failOnRerender` | `false` | Fail when a route re-renders instead of hydrating |
| `failOnUndetected` | `false` | Fail when verification cannot classify a route |
| `failOnVerificationError` | `false` | Fail when verification cannot run on a route |
| `failOnBuildOriginMetadata` | `false` | Fail when metadata still points at the prerender server |
| `failOnAuditError` | `false` | Fail on audit errors |
| `failOnDrift` | `false` | Fail on drift. `true` covers removed, changed and status-changed; an array selects statuses |

## Audit and drift

| Option | Default | Description |
| --- | --- | --- |
| `audit` | `true` | Check route health, links, metadata, sitemap and CSP |
| `auditIgnoreLinks` | `[]` | Link patterns excluded from audit |
| `drift` | `false` | Compare routes against the saved baseline |
| `baselinePath` | `.snappy-baseline.json` | Baseline path. Keep it outside the output directory |

Run `npx snappy-prerender --help` for CLI flags.

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

`report` includes `routes`, `files`, `routeDetails`, `errors`, `verification`, `audit`, `drift`, `sitemap`, `llmsTxt`, `truncated` and `ok`. See [report.md](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/report.md) for the full schema.

The package exports `DEFAULTS`, `prerender` and `resolveConfig`. The default export is the Vite plugin.
