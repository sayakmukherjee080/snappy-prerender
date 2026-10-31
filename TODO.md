# TODO

## 2.7 performance pass

- [x] Add phase timing metrics to the run report.
- [x] Add a repeatable large-site benchmark for render, write, verify and audit phases.
- [x] Reuse a single parsed document for final output processing.
- [x] Add an early exit for preload injection when there are no hints.
- [x] Collapse render page evaluations into fewer browser round trips.
- [x] Collapse verification page evaluations into one browser round trip.
- [x] Replace quadratic verification/report lookups with maps.
- [x] Parallelize audit link existence checks while preserving finding order.
- [x] Parallelize route output writes with ordered merging.
- [x] Cache inline stylesheet text across routes.
- [x] Reuse or cache critical CSS processing where safe.
- [x] Parallelize destination copies and skip unchanged files.
- [x] Overlap independent startup work.
- [x] Parallelize sitemap-index child fetches.
- [x] Remove dead normalization metrics and deduplicate collected links.
- [x] Benchmark verification context reuse and decide whether to expose it.
- [x] Run lint, unit, integration and testcase acceptance; compare output and timings.

Verified: lint clean; 313 unit tests; 142 integration tests; static benchmarks improved
(200 routes 106.6s -> 90.5s; 50 routes with verification 51.3s -> 45.9s).
The expanded testcase now covers 201 routes (200 published + 404): both the current
source and npm 2.7.0 hydrate all 201, report 0 audit findings, write the same output,
and produce a 179-entry sitemap. The 21 lab routes hydrate 20/21 in the unlocked lab
run; the `use`/Suspense resource lab re-renders by design. Client-rendered prerenders
still cannot match React `useId`, Suspense markers or Activity hydration, so the
testcase uses explicit IDs and mounts Activity on demand.

## 2.8 deterministic time, hydration policies, locales and SEO locale

Plan: `/home/ubuntu/openchamber/.opencode/plan/snappy-prerender-2.8-date-locale-hreflang.md`

### Config, CLI and docs contract

- [x] Add `freezeTime`, `timezone`, `randomSeed` defaults and validation.
- [x] Add global `hydration.allowRerender` / `hydration.skip` and `routeOverrides[].hydration`.
- [x] Add `locales` defaults, validation and warnings for path/single mode.
- [x] Add `seoLocale` defaults, validation and warnings for cookie/localStorage seeding.
- [x] Resolve `locales[].storageState` relative to the config file.
- [x] Add CLI flags and help for clock, hydration, and simple locale/SEO locale controls.
- [x] Document the full config contract in README and docs.

### Deterministic clock

- [x] Add `src/core/clock.js` with fixed-time resolution and init script.
- [x] Support `freezeTime: true`, ISO strings and epoch numbers, with `SOURCE_DATE_EPOCH`.
- [x] Apply fixed time in render and verification before navigation.
- [x] Apply `timezone` to render/verification contexts.
- [x] Apply deterministic `Math.random` when `randomSeed` is set.
- [x] Expose `window.__SNAPPY_NOW__` and `window.__SNAPPY_NOW_ISO__`.
- [x] Report fixed clock details.

### Hydration policies

- [x] Add `src/core/hydration-policy.js` with strict, allow-rerender and skip resolution.
- [x] Apply global and route-override policies in verification.
- [x] Report allowed, skipped, ignored hydration errors and the policy per route.
- [x] Ensure `failOnHydrationError` and `failOnRerender` respect allowed routes.
- [x] Update limitations documentation.

### Locales and hreflang

- [x] Add `src/core/locales.js` with locale lookup, route mapping and URL helpers.
- [x] Expand base routes into locale variants in path mode.
- [x] Keep single mode on normal paths with one active locale.
- [x] Ignore non-default locale prefixes during default-locale crawling.
- [x] Apply `<html lang>`, `dir`, canonical, `og:locale` and `og:locale:alternate`.
- [x] Apply self, alternate and `x-default` hreflang links.
- [x] Make locale metadata injection idempotent with `data-snappy-locale`.
- [x] Feed generated alternates into sitemap `xhtml:link` output.
- [x] Add hreflang and html language audit rules.
- [x] Add `og:locale:alternate` support to the head component.
- [x] Report locale per route and locale summary.

### SEO locale for cookie/localStorage apps

- [x] Add `src/core/seo-locale.js` with seeding and script generation.
- [x] Seed cookies and localStorage during render and verification.
- [x] Emit an output bootstrap script before the app bundle.
- [x] Support `localStorage`, `cookie`, `both`, `overwrite`, `navigator`, `htmlLang` and `routes`.
- [x] Externalize the bootstrap under `csp: 'strict'` or `externalScripts`.
- [x] Hash the inline bootstrap under `csp: 'hash'`.
- [x] Reject `removeScriptTags` with output injection.
- [x] Report the generated script and locale summary.

### Tests and acceptance

- [x] Unit tests for config, clock, hydration policy, locales, SEO locale, page meta, audit and report.
- [x] Integration fixture for `Date.now()` copyright output.
- [x] Integration fixture for hydration allow-rerender and skip.
- [x] Integration fixture for path-prefixed locales and hreflang.
- [x] Integration fixture for single-mode cookie/localStorage locale seeding.
- [x] Integration fixture for CSP hash and strict bootstrap handling.
- [x] Run lint, unit tests and the full integration suite.
- [x] Run the expanded testcase acceptance against the current source.
- [x] Check every checklist item before reporting completion.

Verified: lint clean; 358 unit tests; 153 integration tests; the expanded testcase
hydrates 201/201 routes with 0 audit findings, writes the same output as the 2.7
baseline and produces a 179-entry sitemap. The 21 lab routes hydrate 20/21 in the
unlocked lab run; the `use`/Suspense resource lab re-renders by design.

## Client-side head parity

- [x] Add `tags` for `script`, `style`, `noscript` and `base`, with escaped text and trusted `noscript` HTML.
- [x] Add `htmlAttributes`, `bodyAttributes` and `titleAttributes` with restoration.
- [x] Add `defaultTitle`.
- [x] Preserve multiple `images`, `alternateLocales` and duplicate `extra` metas.
- [x] Add `onChangeClientState`.
- [x] Adopt React 19 native head tags without duplicating them.
- [x] Document the head API with JSDoc types; add no TypeScript files or `types` export.
- [x] Add a committed React 19 native-title navigation regression test.
- [x] Add a testcase build gate that refuses API source-error pages.
- [x] Update README, limitations and changelog.
- [x] Run lint, unit tests and the full integration suite.
- [x] Re-run testcase acceptance and compare output with the previous baseline.

Verified: lint clean; 365 unit tests; 156 integration tests. Every route from the
previous 201-route testcase baseline still hydrates; the current testcase app adds 51
API article routes that re-render from their own live data. The lab run still hydrates
20/21, with the `use`/Suspense resource lab re-rendering by design.

## Deployment verification (2026-10-30)

- [x] Build the 254-route testcase with 51 live API article routes.
- [x] Prerender the public site: 255 routes, 204 hydrated, 51 API re-renders allowed, 0 audit findings.
- [x] Prerender the unlocked lab: 24 routes, 23 hydrated, 1 Suspense re-render allowed, fixed clock, French single-locale matrix and SEO locale bootstrap.
- [x] Run the public browser suite through a Cloudflare quick tunnel: 9/9 checks.
- [x] Run the lab browser suite through the same tunnel: 13/13 checks covering every new head feature, locales, SEO locale, defaultTitle, noindex and attribute restoration.
- [x] Verify 230 sitemap entries, 254 preload-manifest entries and a single noindex robots directive on the 404 page.
- [x] Final suites: 366 unit, 157 integration, 17 testcase tests; public browser suite 9/9 and lab suite 13/13 through the tunnel before it was stopped.

## Later

- [x] Add a per-route hydration ignore list so known false positives can be suppressed for specific routes without disabling verification globally.
- [ ] Document or support `useId`, Suspense and Activity hydration for client-rendered prerenders; `useId` IDs encode the hydration mode and cannot match a client render.

No outstanding non-critical test gaps.
