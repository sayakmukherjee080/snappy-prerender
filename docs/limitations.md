# Limitations

- **Build-time data is a snapshot.** Anything fetched during rendering is frozen into the
  HTML until the next build. Use `cacheAjaxRequests` and `snapSaveState` so the client
  replays the same data.
- **Hydration mismatches are your app's to fix.** The verifier tells you exactly which route
  and which framework error. Common causes: `Date.now()`, `Math.random()`, `localStorage`
  reads during render, viewport-dependent markup, and CSS-in-JS that re-injects styles on
  hydration.
- **Markup that depends on load state cannot hydrate.** A component that swaps a placeholder
  for real content once an image or widget loads renders one thing during prerendering
  (where the network has settled) and another on the client's first render. The verifier
  reports those routes as `re-rendered`. Render deterministic markup instead — a plain
  `<img loading="lazy">` rather than a JS placeholder swap — or accept the re-render.
- **Authenticated routes need `storageState`.** Never prerender personal data into static
  HTML without deciding to.
- **Runtime-only routes** (heavy API dependence, real-time data) are better served by
  `serveCmd` or left client-rendered.
- Route query strings are ignored; routes are deduplicated without them.
- Routes whose decoded path contains dot segments or backslashes are skipped, so encoded
  traversal cannot create stray directories.
- Crawling is unbounded unless `maxRoutes` is set; hitting the cap marks the run as failed
  so incomplete output is never shipped silently. With `maxRoutes` or `routePriority`, the
  crawl runs in deterministic waves and reports exactly which routes did not fit in
  `truncated.droppedRoutes`.
- **React 19 native metadata.** React hoists `<title>` and `<meta>` rendered in JSX and
  leaves an existing template title in place, so using both systems produces two titles in
  the output. Use one of them; the run warns when a page ships more than one `<title>`.
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
- **`reuseVerificationContext` shares browser storage between routes.** Use it only for
  stateless apps; authenticated routes can see cookies or storage from another route.
- **Failure traces can contain request data.** `traceOnError` is opt-in and writes a
  Playwright archive under `snappy-traces/` in the output directory.
