# Before/after demo

A small vanilla Vite app built twice:

- `/before/` — the normal SPA output: an empty `#root` until the module script runs.
- `/after/` — the same output after `snappy-prerender` has written the settled DOM per route.

The landing page compares the two with a captured four-stage playback and crawler-visible
HTML metrics. The SPA pane starts with the raw empty `#root`, then shows the header, hero, and
full content at 0 / 500 / 1,100 / 1,800 ms. The prerendered pane is full at t=0 and its later
frames show the same document after hydration. Separate iframes show the raw HTML source as a
crawler receives it, and WhatsApp, X and Facebook previews use the generated Open Graph tags.
The header links to `/releases/`, a changelog page generated from the repository's
`CHANGELOG.md` at build time.

## Build

From the repository root:

```sh
node demo/build.mjs
```

Set the public origin used by canonical and sitemap URLs when building for a real host:

```sh
DEMO_ORIGIN=https://demo.example.com node demo/build.mjs
```

## Serve

```sh
node demo/serve.mjs --port 4180
```

Open `http://127.0.0.1:4180/`. The landing page is served at `/`, the SPA at `/before/`,
and the prerendered build at `/after/`.

The build output under `demo/site/` is generated and ignored by git.
