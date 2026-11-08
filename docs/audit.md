# Audit, reports and content drift

Every run produces a report and a report-only site audit. Content drift compares a build against a saved baseline.

## Audit

The audit runs by default and reports:

- route errors, truncation, empty or duplicate output, and broken internal links;
- duplicate or missing metadata, canonical mismatches, heading counts, sitemap disagreement and orphan pages;
- CSP violations reported by the browser.

Findings go to `report.audit` and the log. They do not fail the run unless `failOnAuditError` is true. `auditIgnoreLinks` excludes dynamic links, and `--no-audit` skips the audit. The rule list and JSON schema are in [report.md](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/report.md).

`reportPath` or `--report` writes the report as versioned JSON. URLs are reduced to origin and path, and the storage-state path is redacted.

## Route sources

Routes can come from `include` and crawling, a text or JSON `routesFile`, or a local or remote sitemap through `routesFromSitemap`.

- Relative source paths resolve against the config file.
- Root-relative sitemap locations have `base` stripped.
- Off-origin locations in a remote sitemap are ignored.
- If a route file or sitemap is supplied and `include` is not set, the root is not seeded implicitly.
- With `maxRoutes` or `routePriority`, crawling runs in deterministic breadth-first waves sorted by priority then path.
- `truncated.droppedRoutes` lists routes that did not fit.

`routeOverrides` applies `timeout`, `waitFor`, `readySelector`, `readyFlag`, `crawl`, `storageState`, `hydration`, `framework` and incremental reuse to matching routes. Later entries win per key.

`transformHtml` runs once per route after minification and before preload or CSP injection. It may be async and must return a string or nothing.

## Content drift

Set `drift: true` to store a route baseline between builds:

```js
snappy({
  drift: true,
  baselinePath: '.snappy-baseline.json',
  failOnDrift: ['removed', 'changed'],
});
```

The first complete run writes the baseline and does not report every route as added. Later runs report additions, removals, moves, content changes, HTML-only changes and status changes.

Each record stores a `contentHash` of visible text and SEO metadata, and an `htmlHash` of the final file. A bundle filename change is reported as HTML-only, not content drift.

The baseline is written only after a complete run with no route errors or truncation. A run that fails `failOnDrift` keeps the previous baseline. Dry runs never write it.

Keep the baseline outside the output directory when using `cleanDestination`. The default is `.snappy-baseline.json` beside the project configuration: relative to the config file for the CLI and to `process.cwd()` for the API. In CI, persist it as a cache or artifact, or commit it deliberately.

`report.drift` contains the comparison, and each route record carries `driftStatus` and `driftReasons`. `failOnDrift: true` fails on removed, changed and status-changed routes. Pass an array to choose `added`, `removed`, `moved`, `changed`, `html-only` or `status-changed`.

Use `freezeTime` with an explicit ISO time or `SOURCE_DATE_EPOCH`, and set `randomSeed` when the page renders random content. Otherwise a timestamp or random value will look like content drift.

## Related output checks

`preloadLinks` injects `<link rel="modulepreload">` for runtime chunks, font preloads with their content type, and the LCP image. It complements `preloadManifest`: the manifest is for hosts that send Early Hints, while injected links work on any static host. Script hints are skipped when `removeScriptTags` is on.

`csp: 'hash'` adds a `<meta http-equiv="Content-Security-Policy">` with SHA-256 hashes for inline scripts and styles. It implies `externalScripts: true` and no CSS swap handler, like `strict`. The policy allows `'self'` only, so third-party scripts or styles need their own policy. An existing CSP meta is kept and reported. Inline `style=""` attributes and event handlers cannot be hashed; the audit warns about them and about blocked requests.
