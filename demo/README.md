# Before/after demo

A live demo of snappy-prerender, the framework-agnostic react-snap alternative: the same vanilla
Vite SPA built twice. The package supports React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember
and vanilla JavaScript; the landing page lists the validated versions.

- `/before/`: the normal SPA output, with an empty `#root` until the module script runs.
- `/after/`: the same output after `snappy-prerender` has written the settled DOM per route as
  static HTML.

The landing page compares the two with a captured four-stage playback and crawler-visible
HTML metrics. The SPA pane starts with the raw empty `#root`, then shows the header, hero, and
full content at 0 / 500 / 1,100 / 1,800 ms. The prerendered pane is full at t=0 and its later
frames show the same document after hydration. Separate iframes show the raw HTML source as a
crawler receives it. WhatsApp, X and Facebook previews use the generated Open Graph tags.
The header links to `/releases/`, which the build generates from the repository's
`CHANGELOG.md`.

## Build

From the repository root:

```sh
node demo/build.mjs
```

Set the public origin that the build uses for canonical, Open Graph, sitemap and robots.txt URLs
when building for a real host:

```sh
DEMO_ORIGIN=https://demo.example.com node demo/build.mjs
```

The build writes a root `sitemap.xml` and `robots.txt` for the landing page, releases page and
prerendered routes, in addition to the prerendered build's own sitemap.

## Framework coverage

The landing page includes the validated framework and version table. The source of truth is
[`testcase/README.md`](../testcase/README.md#validation-status), which covers React, Vue, Svelte,
Preact, Angular, Solid, Lit, Ember and vanilla JavaScript.

## Discovery

The landing page and releases page carry canonical, Open Graph and Twitter Card metadata. The
landing page also emits `WebPage` and `SoftwareApplication` JSON-LD. The root `robots.txt` keeps
the intentionally empty `/before/` build and the `/playback/` snapshots out of search results.

## Serve

```sh
node demo/serve.mjs --port 4180
```

Open `http://127.0.0.1:4180/`. The landing page is served at `/`, the SPA at `/before/`,
and the prerendered build at `/after/`.

The build generates `demo/site/`, and git ignores it.
