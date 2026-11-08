# Before/after demo

A live demo of snappy-prerender, the framework-agnostic react-snap alternative. The package supports React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla JavaScript; the landing page lists the validated versions.

- `/before/`: the React testcase (Aether Compute) built as a plain Vite SPA, with an empty `#root` until the module script runs.
- `/after/`: the same app with all 254 routes prerendered by `snappy-prerender`, including per-route metadata, a sitemap, `robots.txt` and `llms.txt` under `/after/`.
- `/check/`: a free site checker that shows the crawler metadata and `llms.txt` for any public URL.
- The landing playback uses the same testcase build, so the captured frames match the hosted pages.

The landing page compares the two with a captured four-stage playback and crawler-visible HTML metrics. The SPA pane starts with the raw empty `#root`, then shows the header, hero, and full content at 0 / 500 / 1,100 / 1,800 ms. The prerendered pane is full at t=0 and its later frames show the same document after hydration. Separate iframes show the raw HTML source as a crawler receives it. WhatsApp, X and Facebook previews use the generated Open Graph tags. The header links to `/releases/`, which the build generates from the repository's `CHANGELOG.md`.

## Features

- **Static HTML for every route.** Crawlers get page content, title and links before JavaScript runs.
- **Metadata that travels.** Titles, descriptions, canonicals, Open Graph, Twitter cards and JSON-LD are written into each page and kept current during client navigation.
- **Sitemap, robots and llms.txt.** Write a sitemap, update robots.txt and generate an llms.txt route index for AI crawlers from the pages you actually built.
- **A check after boot.** Each page is reloaded with your real bundle and reported as hydrated, re-rendered or undetected, with per-route policies.
- **Faster repeat builds.** Reuse unchanged routes, revalidate API data and downloaded assets, and protect the cache from concurrent builds.
- **Assets and output tuning.** Localize third-party CSS, fonts, images and scripts; control critical CSS, minification, preloads and CSP; capture CSS-in-JS, form and Ajax state.
- **Locales without guesswork.** Path or single-locale builds with hreflang, localized URLs, sitemap alternates and SEO locale seeding.
- **Audit and drift reports.** Find broken links, metadata, sitemap and CSP problems, compare builds against a baseline, and write a JSON report.

## Build

The demo installs `snappy-prerender` from the repository root (`file:..`) and builds the React
testcase from `testcase/react`, so run it inside a checkout of this repository:

```sh
cd demo
npm install
DEMO_ORIGIN=https://demo.example.com \
DEMO_API_ORIGIN=https://api.example.com \
npm run build
```

Set `DEMO_ORIGIN` to the public origin used for canonical, Open Graph, sitemap and `llms.txt`
URLs. Set `DEMO_API_ORIGIN` to the checker API origin; leave it empty when `/api/check` is proxied
on the same origin. The build writes `demo/site/` and takes several minutes because it prerenders
all 254 routes and verifies hydration.

The build writes a root `sitemap.xml` and `robots.txt` for the landing page, releases page and
prerendered routes, in addition to the prerendered build's own sitemap.

## Framework coverage

The landing page includes the validated framework and version table. The validation run builds the
18 implementations in [`testcase/`](../testcase); the source of truth for results is
[`testcase/README.md`](../testcase/README.md#validation-status), which covers React, Vue, Svelte,
Preact, Angular, Solid, Lit, Ember and vanilla JavaScript.

## Discovery

The landing page and releases page carry canonical, Open Graph and Twitter Card metadata. The
landing page also emits `WebPage` and `SoftwareApplication` JSON-LD. The root `robots.txt` keeps
the intentionally empty `/before/` build and the `/playback/` snapshots out of search results.

## Site checker

`/check/` calls `GET /api/check?url=...` on the demo server. The endpoint normalises the URL,
rejects private and reserved hosts, follows at most three redirects, caps HTML at 2 MB and
`llms.txt` at 512 KB, and finishes the page plus `llms.txt` work inside a 20-second deadline.
DNS is resolved once per hop and the connection is pinned to that address, so a redirect cannot
rebind to an internal host. Metadata values are clipped before they reach the response, and preview
images are only loaded when their host passes the same public-host checks. It returns
`{ success: true, data }` or `{ success: false, error, code }`.

The standalone API (`demo/api.mjs`) accepts requests only with
`Origin: https://snappy-prerender.smoldev.com`, allows 10 requests per second globally and five
concurrent checks per caller, and keeps `GET /health` public for monitoring. Requests without that
origin receive `403 FORBIDDEN_ORIGIN`. It binds to `127.0.0.1:4181`; the public entry is the
Cloudflare tunnel at `psspsst.smolutils.in`, and port 4181 is not opened in the firewall.

The endpoint lives in `demo/server.mjs`; a static-only host needs an equivalent function or the
form will fail. The Postman collection in [`postman/`](../postman/snappy-demo.postman_collection.json)
documents the request.

## Serve

```sh
cd demo
npm run serve -- --port 4180
```

Open `http://127.0.0.1:4180/`. The landing page is served at `/`, the SPA at `/before/`,
the prerendered build at `/after/`, and the checker at `/check/`.

Run the demo's parser, URL-safety, endpoint and 404 tests with:

```sh
npm test
```

The build generates `demo/site/`, and git ignores it.
