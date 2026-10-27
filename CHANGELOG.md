# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Earlier history predates
the release tags; see the Git history for those changes.

## [Unreleased]

### Added

- `cleanDestination` empties the destination before copying the build output, so assets
  removed from a build do not linger.
- `pruneStaleRoutes` removes pages recorded by the previous run's `.snappy-manifest.json`
  when they are no longer produced, without touching assets or user files.
- New build gates: `failOnEmptyPage` (on by default), `failOnConsoleError`,
  `failOnFailedRequest`, `failOnDuplicateContent`, `failOnUndetected` and
  `failOnVerificationError`.
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
