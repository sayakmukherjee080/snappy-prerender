# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Earlier history predates the release tags; see the Git history for those changes.

## [2.12.2] - 2026-11-08

### Changed

- Cleaned up changelog formatting so GitHub renders release notes without manual line breaks. No runtime changes.

## [2.12.1] - 2026-11-08

### Changed

- Shortened the feature summary in the README and demo. No runtime changes.

## [2.12.0] - 2026-11-08

### Added

- `llmsTxt` generates an `llms.txt` route index with sections, page titles, descriptions and links.
- The object form accepts `file`, `title`, `description`, `include`, `exclude` and `maxRoutes`.
- CLI flags: `--llms-txt`, `--llms-txt-file` and `--llms-txt-max-routes`.
- `report.llmsTxt` records the file, route count, sections and listed URLs.

### Changed

- `llms.txt` is rebuilt on cached runs and skipped for dry runs and image output.

## [2.11.4] - 2026-11-07

### Changed

- Expanded the README feature summary. No runtime changes.

## [2.11.3] - 2026-11-07

### Added

- Incremental prerendering with `incremental: true` (revalidate), `incremental: 'trust'` and `incremental: false`. Unchanged routes are restored from a persistent cache instead of being rendered again.
- Per-route dependency fingerprints for source HTML, referenced JS/CSS, local asset existence, output configuration and the written page hash. Cached HTML lives outside `dist`, so a normal Vite, CRA or static build can replace the output directory without losing reusable pages.
- API response revalidation for recorded `GET`/`HEAD` requests. Shared endpoints are deduplicated, `ETag`/`Last-Modified` conditional requests are used when available, and a changed body hash renders only the routes that depend on it. Requests with `Authorization`, non-GET methods, oversized bodies, streaming, or failed responses are never replayed and always render.
- `incremental.cachePath`, `incremental.maxAge`, `incremental.lockTimeout`, `incremental.exclude`, `incremental.data.hosts`, `incremental.data.maxBytes` and `routeOverrides[].incremental`.
- A cache lock beside the cache file stops two builds from writing or pruning the same cache at once. The default fails fast with the owning pid; `incremental.lockTimeout` waits for a bounded time, and a lock left by a dead process is reclaimed.
- Cache maintenance now prunes unreferenced root HTML pages, generated state and SEO scripts, and vendored assets and manifests, so removed routes and changed assets do not accumulate in the cache directory.
- A capped crawl (`maxRoutes`) writes the accepted routes to the incremental cache instead of discarding the whole cache entry, so route priority and cache reuse work together.
- Asset localization with `vendorAssets`: download allowlisted CSS, fonts, images and optionally scripts into content-hashed `snappy-assets/` files and rewrite HTML, CSS `@import`, `url()`, `srcset`, style attributes and inline `<style>` references.
- `vendorAssets.hosts`, `vendorAssets.types`, `vendorAssets.maxBytes`, `vendorAssets.onError` (`warn`/`fail`) and `vendorAssets.failOnExternalAssets`.
- Vendored asset source hashes participate in incremental revalidation. Local vendor files, generated state scripts and SEO locale scripts are cached and restored.
- CLI flags for incremental caching, data revalidation limits, asset localization and the self-contained asset gate.

### Changed

- `preloadLinks` now reads script hints from the final document and merges them with runtime-loaded chunks, so localized and dynamically imported scripts both get hints.
- Verification skips cached routes and records whether a route was verified; intentionally skipped hydration routes remain reusable.

### Fixed

- Routes whose vendor download failed under `vendorAssets.onError: 'warn'` are not written to the incremental cache, so the next build retries the download instead of reusing a page with an external asset.
- `inlineCss: 'inline'` no longer fetches cross-origin stylesheets during the render pass, which previously made the route uncacheable and left the localized CSS as a link. Local `snappy-assets/` stylesheets, including localized `@import` rules, are inlined after asset localization.
- Concurrent routes that reference the same vendored asset now share one in-flight write instead of racing on the same temporary file.

### Security

- Vendor downloads enforce the host allowlist, redirect re-checks, private-host rejection unless explicitly allowlisted, TLS validation, per-asset byte limits and content-type checks. A response whose content type does not match the requested CSS, script, font or image kind is refused instead of being written as a local asset. API response bodies and credentials are never written to the cache.

## [2.11.2] - 2026-11-07

### Changed

- README now leads with the framework-agnostic react-snap alternative positioning for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla JavaScript, adds a react-snap comparison, framework quick starts, a validated-version table, AI-crawler guidance and an FAQ.
- npm description and keywords now name react-snap, every supported framework and the migration queries, and the author field points at the GitHub profile.
- The demo landing page and app copy carry the same framework coverage and a validated framework table.
- Package and documentation links in the README are absolute so they work on both GitHub and npm. No runtime behaviour changed.

## [2.11.1] - 2026-11-06

### Added

- `drift`, `baselinePath` and `failOnDrift` store a per-route baseline and report added, removed, moved, changed, HTML-only and status-changed routes.
- `htmlHash` for the exact written file and `contentHash` for a normalized fingerprint of visible text, SEO metadata, links, images and JSON-LD. Ordinary script and style changes do not count as content drift.
- `report.drift` with per-route `driftStatus` and `driftReasons`, plus a baseline schema in `docs/report.md`. The JSON report version is now 2.
- `sitemapLastmod` adds `<lastmod>` from the baseline. New and content-changed routes get the build date; unchanged and HTML-only routes keep their previous date.
- CLI flags `--drift`, `--baseline`, `--fail-on-drift`, `--fail-on-drift-status` and `--sitemap-lastmod`.

### Changed

- Baselines are written only after a complete, non-dry run. Incomplete builds and failed `failOnDrift` runs keep the old baseline and preserve previous sitemap dates.
- A baseline is kept outside the output directory by default so `cleanDestination` cannot delete it.

### Fixed

- Sitemap `lastmod` uses the real build start instead of `freezeTime`, so a fixed content clock no longer prevents deployment dates from advancing.
- A failed `failOnDrift` run keeps the previous baseline, so the next run still compares against the last accepted build.

## [2.11.0] - 2026-11-06

### Added

- Framework verification for Angular, Ember and Lit from DOM markers, and explicit `framework: 'solid'` support for Solid client renders.
- Angular, Ember, Lit and Solid hydration mismatch patterns.
- `container` config option and `--container` CLI flag for app roots outside `#root`, `#app` or `#__next`. A missing configured selector fails the route instead of silently using the body.
- Ember's script-first body is handled by selecting the application body and skipping vendor scripts when capturing the prerendered child.
- Custom container selectors are resolved in the browser for both the live and written documents before computing `firstMismatch`.
- `routeOverrides[].framework` for per-route framework selection.

### Changed

- Verification results now identify Angular, Ember and Lit routes instead of reporting them as `undetected` or `unknown`.

## [2.10.1] - 2026-11-01

### Changed

- An explicit `framework` is now authoritative: it selects mismatch patterns and treats the route as mounted even when a custom root has no framework marker.
- Svelte auto-detection no longer treats the page-wide `window.__svelte` global as a root marker; Svelte 5 mount-only shells must set `framework: 'svelte'`.

### Fixed

- `Head` preserves URL fragments when a trailing-slash convention is applied.
- The head manager prefers the newest matching tag when React 19 native metadata and app-owned metadata share a key, so React can remove its own node on navigation.

## [2.10.0] - 2026-10-31

> The items below are repository test-fixture changes. `testcase/` is not included in the
> published npm package, so 2.10.0 does not change package runtime behavior.

### Fixed

- Framework parity fixtures now release mobile scroll locks and close the header menu on every navigation path, including brand links, browser history, and the palette shortcut.
- Palette preference changes wait for asynchronous host renders before reopening, and rapid navigation renders no longer attach duplicate island listeners.
- The Preact fixture no longer double-mounts through `flushSync`, and site controllers expose `dispose()` for effect cleanup.
- The French lab fixture no longer leaks `lang` or `og:locale` metadata onto later pages, and locked lab pages stay English.
- Lab dialogs, canvas animation frames, and worker timers are cleaned up when their route is replaced.
- Missing API records and API source failures are noindex and non-canonical; missing hashes scroll to the top instead of preserving the previous position.
- The React reference router falls through to the 404 page for malformed percent escapes.

## [2.9.0] - 2026-10-31

### Added

- Svelte 5 framework detection from the `window.__svelte` runtime global and the `<!--[-->` hydration anchor, in addition to the existing Svelte 3/4 markers.

### Changed

- Hydration verification now records the first-element chain beneath the app container, not just the container's first child. An app that keeps its outer wrapper but replaces the prerendered page inside it is reported as `re-rendered` instead of `hydrated`.
- The metadata audit no longer warns about a missing canonical on the configured not-found page, because a 404 document is intentionally not canonicalised.

### Fixed

- Pre-rendered host wrappers no longer report a false `hydrated` result when they discard the page content while preserving the container element.

## [2.8.1] - 2026-10-31

### Changed

- README now includes the Product Hunt launch badge. No runtime behaviour changed.

## [2.8.0] - 2026-10-31

### Added

- `freezeTime`, `timezone` and `randomSeed` make `Date`/`Date.now()` and optional `Math.random()` deterministic across render and verification. `SOURCE_DATE_EPOCH` is honoured, and pages can read `window.__SNAPPY_NOW__` / `window.__SNAPPY_NOW_ISO__`.
- `hydration.allowRerender` and `hydration.skip`, plus `routeOverrides[].hydration`, let explicitly dynamic routes re-render without being reported as failures.
- `locales` adds path or single locale modes with automatic `<html lang>`, canonical, `og:locale`, `og:locale:alternate`, self/alternate/`x-default` hreflang, sitemap alternates, translated route maps and hreflang audit rules.
- `seoLocale` seeds a cookie or `localStorage` locale before render and verification, and optionally writes a pre-app bootstrap into the output. It supports localStorage, cookie or both, `overwrite`, `navigator`, `forceHtmlLang`, route scoping, CSP hash and strict externalization.
- CLI flags for the clock, hydration policies, simple locale matrices and SEO locale.
- Report fields for the fixed clock, locale counts, per-route locale, hydration policy, allowed re-renders, ignored hydration errors and generated locale scripts.
- `Head` accepts `tags` for arbitrary `script`, `style`, `noscript` and `base` elements, with attribute objects, text, trusted `noscript` HTML and explicit keys.
- `Head` accepts `htmlAttributes`, `bodyAttributes` and `titleAttributes`, restoring the document's original attributes when no Head wants them.
- `Head` accepts `defaultTitle`, multiple `images` and multiple `alternateLocales`; repeated same-name `extra` metas can opt into duplicates. These replace the client-side surface of React Helmet and React Helmet Async.
- `Head` accepts `onChangeClientState` for observing added, removed and changed entries after real DOM updates.
- React 19 native `<meta>` and `<link>` tags are adopted and updated instead of duplicated. A correct native `<title>` is left to React so navigation can remove it, while older template titles are removed.
- The head entry documents `HeadProps`, `HeadTag`, `HeadAttributes` and `HeadChange` with JSDoc types; the package remains plain JavaScript and adds no TypeScript files.

### Changed

- Final HTML processing uses one parsed document for preload injection, CSP hashes, page metadata and preload resources instead of reparsing after each step.
- Render and verification use fewer Playwright round trips.
- Route writes, audit link checks, destination copies and sitemap-index fetches run with bounded concurrency; route reports are merged in deterministic order.
- Preload hints are sorted, so repeated builds do not reorder modulepreload links.
- Inline stylesheet text and critical CSS processor state are cached within a run.
- Relative route-source loading and browser/server startup overlap where safe.
- The JSON report includes phase timings, and `npm run benchmark` measures large sites.
- `reuseVerificationContext` optionally reuses one browser context per verification worker.
- A not-found page's generated noindex replaces an existing robots directive instead of adding a second meta tag.

## [2.7.0] - 2026-10-29

### Added

- Site audit for route health, links, metadata, sitemap and CSP. Findings are report-only unless `failOnAuditError` is set; `auditIgnoreLinks` excludes dynamic links.
- `reportPath` / `--report` writes a versioned JSON report with per-route records, audit, verification, sitemap, preload manifest, truncation and traces.
- `routesFile` and `routesFromSitemap` seed routes from text, JSON or a sitemap. Sitemap indexes are followed one level, and relative paths resolve against the config file.
- Deterministic BFS crawling when `maxRoutes` or `routePriority` is set. `truncated.droppedRoutes` lists the routes that did not fit.
- `routeOverrides` for per-route timeout, wait, readiness, crawl and storage state.
- `transformHtml`, sync or async, runs before preload and CSP injection.
- Framework detection for React, Vue, Svelte and Preact, with framework-specific hydration messages and `firstMismatch` details.
- `preloadLinks` for runtime chunks, fonts and the LCP image.
- Sitemap hreflang alternates, image entries and `sitemap.locs` in the report.
- Head JSON-LD, `lang`/`dir` and hreflang alternates.
- App-declared 404 pages via `<meta name="prerender-status-code" content="404">`.
- `csp: 'hash'` adds a meta policy with SHA-256 hashes for inline scripts and styles.
- `retries`, `retryDelay` and `traceOnError` for failed renders.
- `init` migration for a legacy `reactSnap` block.
- CLI flags and documentation for the new options.

### Changed

- Verification reports the detected framework and uses its hydration message patterns.
- SVG `<title>` elements are no longer counted as page titles.
- Page metadata, audit findings and sitemap entries use the final HTML after transform and preload injection.
- Route sources resolve relative paths against the config file. Sitemap base and origin handling is stricter.
- The JSON report includes the verification summary, uses crawl acceptance order for `order`, and redacts credentials, query strings and the storage-state path.

### Fixed

- A configured `notFoundRoute` may return HTTP 404 and is still written as `404.html`; verification accepts that status for the same route.
- An explicit `framework` selects its hydration message patterns during verification.
- A non-string `transformHtml` result fails that route with a clear error.
- `routeOverrides` ignores undefined values instead of clearing base settings.
- `audit.linksChecked` counts every link pair considered, and route-health findings are included in the audit.
- `preloadLinks` does not preload scripts removed by `removeScriptTags` or `transformHtml`.
- CSP hash mode warns when the generated policy blocks a browser request.
- `init` normalises a single-string `reactSnap.include`.
- The image sitemap collects `srcset` and `<picture><source>` candidates.
- New no-op option combinations produce configuration warnings.

## [2.6.0] - 2026-10-27

### Added

- `cleanDestination` empties the destination before copying the build output, so assets removed from a build do not linger.
- `pruneStaleRoutes` removes pages recorded by the previous run's `.snappy-manifest.json` when they are no longer produced, without touching assets or user files.
- New build gates: `failOnEmptyPage` (on by default), `failOnConsoleError`, `failOnFailedRequest`, `failOnDuplicateContent`, `failOnUndetected`, `failOnVerificationError` and the optional `failOnBuildOriginMetadata`.
- `browserDownloadVersion` pins the Chrome for Testing build id; a cached build is now used without contacting the version feed, so offline rebuilds work.
- `stripBuildOriginMetadata` removes canonical and social tags that point at the prerender server instead of shipping loopback URLs.
- Reports now expose `consoleErrors`, `failedRequests`, `emptyPages`, `duplicatePages` and `pruned`; page files carry `noindex`, and verification entries carry `status` and `empty`.
- CLI flags for the new gates and for `quietPeriod`, `scrollStepDelay`, `serveCmdTimeout`, `shutdownTimeout`, `maxCachedBytes`, `viewport`, `readyFlag`, `readySelector`, `headless`, `cleanDestination` and `metadata.base`.
- A Node 22/24 test workflow and a dedicated integration suite for the audit fixes.

### Changed

- **Breaking:** the minimum supported Node version is now 22.12, matching `@puppeteer/browsers`.
- **Breaking:** an explicit `browser` choice no longer falls back to another engine. `chromium` uses a Playwright-managed Chromium and asks you to install it when missing; `auto` is the only choice that walks machine, Playwright cache, cached Chrome for Testing, then download.
- **Breaking:** `include` is a true output allowlist. A wildcard-only list still seeds the root for crawling, but the seed itself is not written. Passing `include: ['/']` is treated as the default and leaves crawling enabled.
- **Breaking:** canonical, Open Graph and sitemap URLs share one page-path policy: directory output keeps its trailing slash, flat output stays extensionless, and an explicit `trailingSlash` wins.
- **Breaking:** sitemap entries no longer carry `lastmod` (a build date claimed every page changed), noindex pages are excluded, and sitemaps above 50,000 URLs are split behind a sitemap index.
- **Breaking:** `metadata.siteUrl` must be an origin without a path; sub-path deployments belong in `base`. A `serveCmd` URL with a path is rejected for the same reason.
- **Breaking:** `removeStyleTags` combined with `inlineCss: 'inline'` or `true` is rejected instead of silently removing the CSS that was just inlined.
- Empty output now fails a route by default; 404 pages are emitted with a robots `noindex` tag.
- Third-party blocking now covers WebSockets and accepts hostnames with ports, wildcard suffixes and leading-dot suffixes. Service workers are blocked during rendering and verification.
- Verification uses a real browser user agent and the same reduced-motion context as the render pass; mode counts are always logged and can fail the build with `failOnUndetected`.
- Inlined stylesheets rebase relative `url()` values against their source stylesheet; sheets using `@import` stay linked to preserve the cascade.
- Preload manifests are derived from the final HTML, so inline CSS, tag surgery and failed writes no longer leave stale hints. The not-found route is omitted.
- Screenshots use the same unchanged-file check as HTML and dry runs report the image file instead of an HTML one.
- `init` reads Vite's resolved `outDir` and `base`, and Create React App's `homepage`, so the wizard no longer guesses `dist` and `/` for custom projects. During a prerelease it prints the `@next` install tag.
- Unknown config keys and options that have no effect in the current combination now produce warnings instead of being ignored silently.
- Rendered output is split across smaller modules; `run.js` is back under the 600-line limit.

### Fixed

- `setHead` called an undefined helper and threw `ReferenceError`.
- HTTP 4xx/5xx navigations, empty pages and zero-route runs could be written and reported as successful; they now fail with route-level errors.
- The static server served `index.html` for dead extensionless links and failed dotted routes; HTML navigations now fall back deliberately and duplicate output is detected.
- Canonical and `og:url` doubled a non-root `base` path.
- `verifyChangedOnly` could skip a changed page when a shared state script was unchanged.
- `asyncScriptTags` marked the injected state script `async`, allowing it to run after the application bundle.
- `removeAttributes` with a global or sticky RegExp skipped every other match.
- Output collisions that differ only by case are detected on case-insensitive filesystems.
- A destination inside the source directory recursed until the path length limit.
- Inlined CSS lost relative font and image URLs.
- Build-server metadata shipped loopback canonical and social URLs.
- Preload manifests described resources the final page no longer loaded.
- Sitemap and canonical URLs disagreed on trailing slashes and flat output.
- Allowed-host matching ignored ports and wildcards, and WebSocket requests bypassed blocking.
- Browser downloads needed the network even when a cached browser was available.
- The CLI advertised `--preconnect-third-party` without defining it, and several other documented flags had no CLI equivalent.

## [2.6.0-rc.3] - 2026-10-03

### Added

- Computed config files: `snappy.config.js` may export an async function that returns options, so routes can come from a CMS, sitemap or file listing.
- Sitemap generation and the `sitemap` option.
- Stable output: unchanged pages, state scripts and artifacts are left untouched.
- React 16.8 and 17 fixtures and integration coverage.

### Changed

- Documentation links to the npm package and notes the release-candidate channel.

## [2.6.0-rc.2] - 2026-09-26

### Added

- `snappy-prerender init` setup wizard, with flags for non-interactive use.
- CSP-friendly output: `csp: 'off' | 'strict'`, `externalScripts` and configurable `criticalCssPreload`.

## [2.6.0-rc.1] - 2026-09-26

### Added

- The `snappy-prerender/head` entry point: `Head`, `setHead`, `clearHead`, metadata defaults, canonical, Open Graph and Twitter tags, and client-side reconciliation.
- Head-layer audit fixes for tag ownership, restoration and repeated runs.

## [2.5.0] - 2026-09-25

### Added

- react-snap feature parity for v2: `inlineCss`, `minifyHtml`, `minifyCss`, `preloadImages`, `cacheAjaxRequests`, `snapSaveState`, `preloadManifest`, `removeBlobs`, `removeStyleTags`, `removeScriptTags`, `asyncScriptTags`, `destination`, `saveAs`, `browserArgs` and `ignoreHTTPSErrors`.
- Hydration verification that reports `hydrated`, `re-rendered`, `undetected` and `unknown`, plus per-route React mismatch messages.
- Third-party requests allowed by default, with opt-in blocking and host allowlists.
