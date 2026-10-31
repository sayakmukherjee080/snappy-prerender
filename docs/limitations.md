# Limitations

- **Build-time data is a snapshot.** Anything fetched during rendering is frozen into the
  HTML until the next build. Use `cacheAjaxRequests` and `snapSaveState` so the client
  replays the same data.
- **Hydration mismatches are your app's to fix.** The verifier tells you exactly which route
  and which framework error. Common causes: `Date.now()`, `Math.random()`, `localStorage`
  reads during render, viewport-dependent markup, and CSS-in-JS that re-injects styles on
  hydration. Use `freezeTime` and `randomSeed` for deterministic build-time values, and
  `hydration.allowRerender`/`skip` for genuinely live routes. A fixed clock is a build and
  verification control only; production still uses real time. `performance.now()` is not
  frozen because schedulers rely on it, and `crypto.randomUUID()` is not patched.
- **Markup that depends on load state cannot hydrate.** A component that swaps a placeholder
  for real content once an image or widget loads renders one thing during prerendering
  (where the network has settled) and another on the client's first render. The verifier
  reports those routes as `re-rendered`. Render deterministic markup instead — a plain
  `<img loading="lazy">` rather than a JS placeholder swap — or accept the re-render.
- **Authenticated routes need `storageState`.** Never prerender personal data into static
  HTML without deciding to.
- **Path locale prefixes need app routing.** `locales.mode: 'path'` renders `/fr/...` pages,
  but the app still has to route that prefix or use translated `routes`. The prerenderer
  cannot rewrite the client router. Path mode expects one public origin; use single mode
  for separate locale domains.
- **Hreflang needs distinct URLs.** A locale selected only by cookie or `localStorage` is
  not a crawlable alternate URL. Use path prefixes, subdomains or separate deployments.
- **`seoLocale` does not create new URLs.** In single mode it produces one locale per
  output. It seeds the prerender/verification browser and optionally writes a bootstrap,
  but it does not create multiple locale URLs. `inject: false` localizes the HTML without
  forcing the visitor's stored locale.
- **`forceHtmlLang` overrides app metadata.** Use it only when the app hardcodes a language
  that disagrees with the SEO locale.
- **Runtime-only routes** (heavy API dependence, real-time data) are better served by
  `serveCmd` or left client-rendered.
- Route query strings are ignored; routes are deduplicated without them.
- Routes whose decoded path contains dot segments or backslashes are skipped, so encoded
  traversal cannot create stray directories.
- Crawling is unbounded unless `maxRoutes` is set; hitting the cap marks the run as failed
  so incomplete output is never shipped silently. With `maxRoutes` or `routePriority`, the
  crawl runs in deterministic waves and reports exactly which routes did not fit in
  `truncated.droppedRoutes`.
- **React 19 native metadata.** React hoists `<title>`, `<meta>` and `<link>` rendered in
  JSX. `Head` adopts a matching hoisted `<meta>` or `<link>` and updates it. A hoisted
  `<title>` that already carries the Head text is left to React (so React can remove it on
  navigation) and older template titles are removed. `titleAttributes` apply only when
  `Head` owns the title. An app should still use one owner per tag: either native React 19
  metadata or `Head`. The run warns when a page ships more than one `<title>`.
- **`Head` is client-side only.** It manages the live document head while the app runs and
  the prerenderer captures the result. It does not provide `HelmetProvider`,
  `helmetContext`, `HelmetData`, `renderStatic()`, streaming head extraction or a
  server-rendering API. A server-rendered app still needs React 19 native metadata or a
  server head manager.
- **`tags` and `noscript.html` are trusted input.** Script and style text is escaped so it
  cannot close its own element, but a `noscript` value is written as inner HTML exactly as
  supplied. Never pass user-generated content there.
- **Attributes belong to the mounted `Head`.** html, body and title attributes are restored
  when no Head wants them, including after client navigation and prerendered hydration. A
  value written outside the head layer while a Head owns the same attribute is overwritten
  on the next render.
- If two routes would write the same file — such as `/` and `/index` with `flatOutput` —
  neither is written and the run fails with a collision error.
- Screenshots are viewport-width full-page captures, so they reflect the configured
  `viewport`, not a device matrix. Identical screenshots are left untouched.
- **Output files from routes that no longer exist** are left in place unless
  `pruneStaleRoutes` is enabled, which deletes only files listed in the previous run's
  `.snappy-manifest.json`.
- **Dead extensionless links** are indistinguishable from SPA routes to the static server,
  so a missing page can render the shell or the app's catch-all 404. Duplicate output is
  reported; set `failOnDuplicateContent` to enforce it, and use an app-level 404 marker
  where possible.
- **Metadata pointing at the build server** is removed by default
  (`stripBuildOriginMetadata: true`) and reported. Set `metadata.siteUrl` so canonical and
  social URLs survive.
- **`inlineCss`** rebases relative font and image URLs against each stylesheet. A sheet that
  uses `@import` is left as a link because concatenating it would change the cascade.
- **`verifyChangedOnly` compares the generated HTML only.** If a bundle keeps the same
  filename while its contents change, that route's HTML is unchanged and its verification
  is skipped; content-hashed asset names (Vite and CRA defaults) make the HTML change as
  well.
- **Destination directories are merged unless `cleanDestination` is on.** That option
  empties the destination first; `pruneStaleRoutes` separately removes pages the run itself
  generated.
- **`removeStyleTags`** cannot be combined with `inlineCss: 'inline'` or `true`; the config
  is rejected instead of silently shipping pages without CSS.
- **CSP `hash` mode cannot cover inline event handlers or `style=""` attributes.** Move
  those styles into a `<style>` element or a stylesheet; the audit warns when attributes are
  present.
- **CSP `strict` does not rewrite `Head` `tags`.** An inline script supplied through
  `tags` is the app's own policy decision; give it a `nonce` the host policy allows or
  externalise it with `src`. The package only externalises its own captured state and SEO
  locale bootstrap.
- **`reuseVerificationContext` shares browser storage between routes.** Use it only for
  stateless apps; authenticated routes can see cookies or storage from another route.
- **Failure traces can contain request data.** `traceOnError` is opt-in and writes a
  Playwright archive under `snappy-traces/` in the output directory.
