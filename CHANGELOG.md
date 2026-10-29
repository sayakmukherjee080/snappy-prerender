# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Earlier history predates
the release tags; see the Git history for those changes.

## [Unreleased]

### Added

- Site audit on by default: broken internal links, duplicate/missing metadata, canonical
  mismatches, heading counts, build-origin metadata, orphan pages, sitemap disagreement,
  and CSP hygiene. Findings are report-only; `failOnAuditError` opts into a build gate, and
  `auditIgnoreLinks` excludes known dynamic links.
- `reportPath` / `--report` writes a versioned JSON report with per-route records, audit
  findings, sitemap, preload manifest, truncation, 404 routes, CSP skips and failure traces.
- `routesFile` and `routesFromSitemap` seed routes from text, JSON, a local sitemap or a
  remote sitemap (indexes followed one level). Supplying either stops the implicit root
  seed unless `include` was set.
- Deterministic breadth-first crawling when `maxRoutes` or `routePriority` is set. The cap
  records every route that did not fit in `truncated.droppedRoutes`.
- `routeOverrides` per-route `timeout`, `waitFor`, `readySelector`, `readyFlag`, `crawl`
  and `storageState`; `transformHtml` for a per-route, optionally async HTML transform.
- Framework-agnostic verification for React, Vue, Svelte and Preact (`framework`), with
  framework detection from DOM markers and per-framework hydration patterns.
- `firstMismatch` hydration locator: bounded diff of the written container against the live
  one, with `path`, `kind`, `expected` and `actual`.
- Static preload injection (`preloadLinks`) for runtime chunks, fonts and the LCP image,
  complementing the Early Hints preload manifest.
- Sitemap depth: hreflang alternates, image sitemap, and `sitemap.locs` in the report.
- Head depth: JSON-LD `structuredData`, `lang`/`dir` on `<html>`, and hreflang `alternates`
  with absolute URLs and the shared trailing-slash policy.
- App-declared 404s via `<meta name="prerender-status-code" content="404">`.
- `csp: 'hash'` adds a meta policy with SHA-256 hashes for inline scripts and styles,
  skipping JSON-LD and data blocks and leaving an existing policy untouched.
- `retries`, `retryDelay` and `traceOnError`; a final failure records the attempt count and
  writes a Playwright trace under `snappy-traces/`.
- `init` reads a legacy `reactSnap` block, maps its options, warns about unknown keys and
  prints the migration table.
- CLI flags for every new option, plus `README` and `docs/` coverage.

### Changed

- Verification reports the detected framework and uses the matching hydration patterns.
- A `<title>` inside SVG is no longer counted as a document title.
- Page metadata is collected after `transformHtml` and preload injection, so the audit and
  sitemap see the final document.
- Relative `routesFile` and `routesFromSitemap` paths resolve against the config file.
- Root-relative sitemap locations have the public base stripped; remote sitemap entries on
  another origin are ignored.
- The JSON report includes the verification summary, uses crawl acceptance order for
  `order`, and redacts credentials, query strings and the storage-state path.

### Fixed

- A configured `notFoundRoute` may return HTTP 404 and is still written as `404.html`;
  verification accepts that status for the same route.
- An explicit `framework` now selects its hydration message patterns during verification.
- A non-string `transformHtml` result fails that route with a clear error.
- `routeOverrides` ignores undefined values instead of clearing base settings.
- `audit.linksChecked` counts every link pair considered, and route-health findings are
  included in the audit.
- `preloadLinks` no longer preloads scripts removed by `removeScriptTags`.
- CSP hash mode warns when the generated policy blocks a browser request.
- `init` normalises a single-string `reactSnap.include`.
- The image sitemap collects `srcset` and `<picture><source>` candidates.
- New no-op option combinations produce configuration warnings.

## [2.6.0] - 2026-10-27

### Added

- `cleanDestination` empties the destination before copying the build output, so assets
  removed from a build do not linger.
- `pruneStaleRoutes` removes pages recorded by the previous run's `.snappy-manifest.json`
  when they are no longer produced, without touching assets or user files.
- New build gates: `failOnEmptyPage` (on by default), `failOnConsoleError`,
  `failOnFailedRequest`, `failOnDuplicateContent`, `failOnUndetected`,
  `failOnVerificationError` and the optional `failOnBuildOriginMetadata`.
- `browserDownloadVersion` pins the Chrome for Testing build id; a cached build is now
  used without contacting the version feed, so offline rebuilds work.
- `stripBuildOriginMetadata` removes canonical and social tags that point at the
  prerender server instead of shipping loopback URLs.
- Reports now expose `consoleErrors`, `failedRequests`, `emptyPages`, `duplicatePages`
  and `pruned`; page files carry `noindex`, and verification entries carry `status` and
  `empty`.
- CLI flags for the new gates and for `quietPeriod`, `scrollStepDelay`,
  `serveCmdTimeout`, `shutdownTimeout`, `maxCachedBytes`, `viewport`, `readyFlag`,
  `readySelector`, `headless`, `cleanDestination` and `metadata.base`.
- A Node 22/24 test workflow and a dedicated integration suite for the audit fixes.

### Changed

- **Breaking:** the minimum supported Node version is now 22.12, matching
  `@puppeteer/browsers`.
- **Breaking:** an explicit `browser` choice no longer falls back to another engine.
  `chromium` uses a Playwright-managed Chromium and asks you to install it when missing;
  `auto` is the only choice that walks machine, Playwright cache, cached Chrome for
  Testing, then download.
- **Breaking:** `include` is a true output allowlist. A wildcard-only list still seeds the
  root for crawling, but the seed itself is not written. Passing `include: ['/']` is
  treated as the default and leaves crawling enabled.
- **Breaking:** canonical, Open Graph and sitemap URLs share one page-path policy:
  directory output keeps its trailing slash, flat output stays extensionless, and an
  explicit `trailingSlash` wins.
- **Breaking:** sitemap entries no longer carry `lastmod` (a build date claimed every page
  changed), noindex pages are excluded, and sitemaps above 50,000 URLs are split behind a
  sitemap index.
- **Breaking:** `metadata.siteUrl` must be an origin without a path; sub-path deployments
  belong in `base`. A `serveCmd` URL with a path is rejected for the same reason.
- **Breaking:** `removeStyleTags` combined with `inlineCss: 'inline'` or `true` is
  rejected instead of silently removing the CSS that was just inlined.
- Empty output now fails a route by default; 404 pages are emitted with a robots
  `noindex` tag.
- Third-party blocking now covers WebSockets and accepts hostnames with ports, wildcard
  suffixes and leading-dot suffixes. Service workers are blocked during rendering and
  verification.
- Verification uses a real browser user agent and the same reduced-motion context as the
  render pass; mode counts are always logged and can fail the build with
  `failOnUndetected`.
- Inlined stylesheets rebase relative `url()` values against their source stylesheet;
  sheets using `@import` stay linked to preserve the cascade.
- Preload manifests are derived from the final HTML, so inline CSS, tag surgery and failed
  writes no longer leave stale hints. The not-found route is omitted.
- Screenshots use the same unchanged-file check as HTML and dry runs report the image file
  instead of an HTML one.
- `init` reads Vite's resolved `outDir` and `base`, and Create React App's `homepage`, so
  the wizard no longer guesses `dist` and `/` for custom projects. During a prerelease it
  prints the `@next` install tag.
- Unknown config keys and options that have no effect in the current combination now
  produce warnings instead of being ignored silently.
- Rendered output is split across smaller modules; `run.js` is back under the 600-line
  limit.

### Fixed

- `setHead` called an undefined helper and threw `ReferenceError`.
- HTTP 4xx/5xx navigations, empty pages and zero-route runs could be written and reported
  as successful; they now fail with route-level errors.
- The static server served `index.html` for dead extensionless links and failed dotted
  routes; HTML navigations now fall back deliberately and duplicate output is detected.
- Canonical and `og:url` doubled a non-root `base` path.
- `verifyChangedOnly` could skip a changed page when a shared state script was unchanged.
- `asyncScriptTags` marked the injected state script `async`, allowing it to run after the
  application bundle.
- `removeAttributes` with a global or sticky RegExp skipped every other match.
- Output collisions that differ only by case are detected on case-insensitive
  filesystems.
- A destination inside the source directory recursed until the path length limit.
- Inlined CSS lost relative font and image URLs.
- Build-server metadata shipped loopback canonical and social URLs.
- Preload manifests described resources the final page no longer loaded.
- Sitemap and canonical URLs disagreed on trailing slashes and flat output.
- Allowed-host matching ignored ports and wildcards, and WebSocket requests bypassed
  blocking.
- Browser downloads needed the network even when a cached browser was available.
- The CLI advertised `--preconnect-third-party` without defining it, and several other
  documented flags had no CLI equivalent.

## [2.6.0-rc.3] - 2026-10-03

### Added

- Computed config files: `snappy.config.js` may export an async function that returns
  options, so routes can come from a CMS, sitemap or file listing.
- Sitemap generation and the `sitemap` option.
- Stable output: unchanged pages, state scripts and artifacts are left untouched.
- React 16.8 and 17 fixtures and integration coverage.

### Changed

- Documentation links to the npm package and notes the release-candidate channel.

## [2.6.0-rc.2] - 2026-09-26

### Added

- `snappy-prerender init` setup wizard, with flags for non-interactive use.
- CSP-friendly output: `csp: 'off' | 'strict'`, `externalScripts` and configurable
  `criticalCssPreload`.

## [2.6.0-rc.1] - 2026-09-26

### Added

- The `snappy-prerender/head` entry point: `Head`, `setHead`, `clearHead`, metadata
  defaults, canonical, Open Graph and Twitter tags, and client-side reconciliation.
- Head-layer audit fixes for tag ownership, restoration and repeated runs.

## [2.5.0] - 2026-09-25

### Added

- react-snap feature parity for v2: `inlineCss`, `minifyHtml`, `minifyCss`,
  `preloadImages`, `cacheAjaxRequests`, `snapSaveState`, `preloadManifest`,
  `removeBlobs`, `removeStyleTags`, `removeScriptTags`, `asyncScriptTags`,
  `destination`, `saveAs`, `browserArgs` and `ignoreHTTPSErrors`.
- Hydration verification that reports `hydrated`, `re-rendered`, `undetected` and
  `unknown`, plus per-route React mismatch messages.
- Third-party requests allowed by default, with opt-in blocking and host allowlists.
