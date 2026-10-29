# Migrating from react-snap

`snappy-prerender init` reads a `reactSnap` block from `package.json` and uses it as the
wizard's defaults, so an existing project can move without retyping its settings. The
migration table is printed after the config is written, together with any ignored or
unknown keys.

## Option mapping

| react-snap | snappy-prerender |
| --- | --- |
| `source` | `sourceDir` |
| `puppeteerArgs` | `browserArgs` |
| `puppeteerIgnoreHTTPSErrors` | `ignoreHTTPSErrors` |
| `skipThirdPartyRequests` | `blockThirdParty` |
| `fixInsertRule` | `captureRuntimeStyles` |
| `fixFormFields` | `captureFormState` |
| `http2PushManifest` | `preloadManifest` |

These keep their name: `include`, `exclude`, `crawl`, `concurrency`, `timeout`, `waitFor`,
`inlineCss`, `minifyHtml`, `minifyCss`, `cacheAjaxRequests`, `preconnectThirdParty`,
`preloadImages`, `removeBlobs`, `removeStyleTags`, `removeScriptTags`, `asyncScriptTags`,
`userAgent`, `viewport`, `saveAs`, `destination`.

Ignored, with a printed explanation: `port` (the prerenderer serves the build itself on an
ephemeral loopback port) and `sourceMaps` (declared by react-snap but never read).

## Other differences

Kept: crawling, include, concurrency, viewport, waitFor, executable path, external server,
third-party skipping (now on by default), `userAgent`, `inlineCss`, `minifyHtml`,
`minifyCss`, `cacheAjaxRequests`, `snapSaveState`, `preconnectThirdParty`, `preloadImages`,
`removeBlobs`, `removeStyleTags`, `removeScriptTags`, `asyncScriptTags`, `destination`,
`saveAs` (html/png/jpeg).

Changed: `http2PushManifest` became `preloadManifest` (browsers removed HTTP/2 push),
`fixInsertRule` became `captureRuntimeStyles` and also covers constructable stylesheets,
`fixFormFields` became `captureFormState`, `puppeteerArgs` became `browserArgs`,
`puppeteerIgnoreHTTPSErrors` became `ignoreHTTPSErrors`, `skipThirdPartyRequests` became
`blockThirdParty` with the same default of allowing them, `exclude` and `maxRoutes` are
new, and `notFoundRoute` replaces the `/404` include convention.

Dropped: `sourceMaps`, `fixWebpackChunksIssue` and `fixInsertRule` (webpack/Chrome-era
workarounds), `port`, `puppeteer.cache`, and the preload polyfill (modulepreload is
universally supported).
