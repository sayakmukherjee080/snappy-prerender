# Report and audit

`reportPath` (CLI `--report <file>`) writes a versioned JSON document after the run. The
file is written through a temporary file, so a reader never sees a partial report, and it
is skipped in `--dry-run`.

```json
{
  "version": 1,
  "generatedAt": "2026-10-28T00:00:00.000Z",
  "durationMs": 0,
  "timings": { "render": 0, "write": 0, "artifacts": 0, "verify": 0, "audit": 0 },
  "ok": true,
  "clock": { "fixedTime": 0, "timezone": "UTC" },
  "locales": {
    "mode": "path",
    "default": "en",
    "active": null,
    "rendered": { "en": 0, "fr": 0 }
  },
  "seoLocale": {
    "code": "fr",
    "source": "both",
    "inject": true,
    "script": "snappy-seo-locale-abc123.js",
    "scripts": ["snappy-seo-locale-abc123.js"]
  },
  "summary": { "routes": 0, "files": 0, "errors": 0, "warnings": 0 },
  "verification": {
    "ok": true,
    "modes": { "hydrated": 0, "re-rendered": 0, "undetected": 0, "unknown": 0 },
    "frameworks": { "react": 0 },
    "skipped": 0,
    "policySkipped": 0,
    "allowed": 0,
    "allowedRerender": 0,
    "errors": []
  },
  "routes": [
    {
      "route": "/",
      "locale": "en",
      "order": 0,
      "file": "index.html",
      "status": "written",
      "bytes": 0,
      "depth": 0,
      "attempts": 1,
      "httpStatus": 200,
      "finalUrl": "http://127.0.0.1:1234/",
      "mode": "hydrated",
      "framework": "react",
      "empty": false,
      "notFound": false,
      "noindex": false,
      "meta": {
        "title": "",
        "description": "",
        "canonical": "",
        "robots": "",
        "lang": "en",
        "dir": null,
        "ogLocale": "en_US",
        "h1Count": 1,
        "alternates": [],
        "localeUrl": null,
        "images": [],
        "inlineStyleAttributes": 0
      },
      "hydrationErrors": [],
      "ignoredHydrationErrors": [],
      "hydrationPolicy": "strict",
      "hydrationAllowed": false,
      "pageErrors": [],
      "consoleErrors": [],
      "failedRequests": [],
      "firstMismatch": null
    }
  ],
  "audit": { "errors": [], "warnings": [], "linksChecked": 0 },
  "sitemap": null,
  "preloadManifest": null,
  "truncated": null,
  "notFoundRoutes": [],
  "duplicateOutputs": [],
  "routeSources": [],
  "cspSkipped": [],
  "traces": []
}
```

The document never includes the full configuration, `storageState`, captured AJAX state,
cookies, tokens, request bodies or full asset URLs containing credentials. It does include
non-secret summaries of the fixed clock, locale mode and SEO locale source. URLs in the JSON
are reduced to their origin and path, and the configured `storageState` path is redacted
wherever it appears in a message. `order` is the crawl acceptance order; with
`maxRoutes` or `routePriority` it follows the deterministic wave order rather than the
alphabetical write order.

## Audit rules

The audit runs by default and reports findings without failing the build. Set
`failOnAuditError: true` (CLI `--fail-on-audit-error`) to make `ok` false when an error is
present. `auditIgnoreLinks` (CLI `--audit-ignore-links`) excludes known dynamic links.

Errors:

- `route-error` — a route failed while rendering, or its output could not be written.
- `route-cap` — `maxRoutes` stopped the crawl before every discovered route was accepted.
- `empty-page` — a route rendered no app content.
- `duplicate-output` — two routes produced byte-identical HTML.
- `broken-internal-link` — an internal link with no written route or output file.
- `duplicate-title` — two routes share a title.
- `multiple-titles` — a page ships more than one document `<title>`.
- `hreflang-invalid` — an alternate has an invalid language code.
- `hreflang-duplicate` — the same hreflang appears more than once on a page.
- `hreflang-missing-return` — same-build alternates do not link back to each other.
- `sitemap-missing-page` — an indexable page is absent from the sitemap.
- `sitemap-unknown-page` — the sitemap lists a URL with no indexable page.
- `sitemap-noindex-page` — the sitemap lists a noindex or 404 page.

Warnings:

- `missing-title`, `missing-description`, `missing-canonical`.
- `duplicate-description`.
- `heading-count` — zero or more than one `<h1>`.
- `hreflang-missing-self`, `hreflang-missing-x-default`.
- `hreflang-canonical-mismatch`, `html-lang-missing`, `html-lang-mismatch`,
  `og-locale-missing`.
- `canonical-mismatch` — canonical differs from the expected public URL.
- `build-origin-metadata` — a tag still points at the build server.
- `orphan-page` — an indexable page no written page links to.
- `inline-style-attributes` — `csp: 'hash'` cannot cover `style=""` attributes.
- `existing-csp-meta` — a CSP meta already existed, so hashes were not injected.
- `csp-console-violation` — the browser reported a request blocked by the generated policy.
