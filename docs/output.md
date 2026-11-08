# Output, assets and captured state

How the prerenderer cleans and optimises output, handles third-party requests, captures client state and writes to another directory.

## CSS

### Inline and critical CSS

```js
snappy({ inlineCss: 'inline' });   // inline every same-origin stylesheet, remove the links
snappy({ inlineCss: 'critical' }); // inline above-the-fold CSS, defer the rest
snappy({ inlineCss: true });       // alias for 'inline'
```

`'inline'` reads stylesheet text from the live page, so blob-backed CSS-in-JS sheets are included. Stylesheets that cannot be fetched, and non-screen media such as print styles, stay as links.

`'critical'` uses [beasties](https://github.com/danielroe/beasties):

```sh
npm install --save-dev beasties
```

It inlines critical CSS and converts the remaining stylesheets to non-blocking loads with `media="print"`, an inline `onload` handler and a `<noscript>` fallback. A strict `script-src` blocks that handler. Use `'inline'` or a nonce-aware setup in that case.

### Minification

```js
snappy({ minifyHtml: true, minifyCss: true });
```

`minifyHtml` uses html-minifier-terser with react-snap's defaults: whitespace collapsing, boolean attribute collapsing and attribute sorting. Whitespace collapsing changes text nodes, which hydrating frameworks can detect. Use `{ collapseWhitespace: false }` if verification reports mismatches.

`minifyCss` uses clean-css and also minifies CSS inlined into the HTML.

### Link hints

```js
snappy({ preconnectThirdParty: true, preloadImages: true, preloadManifest: true });
```

- `preconnectThirdParty` (default `true`) adds `<link rel="preconnect">` for every third-party origin the page tried to reach, including blocked origins.
- `preloadImages` adds `<link rel="preload" as="image">` for same-origin images the page loaded.
- `preloadManifest` writes `preload-manifest.json` with a `Link` header value per route for the scripts and stylesheets still referenced by the final HTML. Entries respect `ignoreForPreload` (default `['service-worker.js']`), inline CSS, tag removal and the base path.

### Sitemap

```js
snappy({ sitemap: true, metadata: { siteUrl: 'https://example.com' } });
```

The sitemap uses the same page-path policy as canonical URLs. `noindex` pages and the not-found route are omitted. Above 50,000 URLs it is split behind a sitemap index.

Entries have no `<lastmod>` by default. With `sitemapLastmod: true`, `drift: true` and `sitemap: true`, new or changed routes get the build time and unchanged routes keep their previous date. `lastmod` uses the real build start, not `freezeTime`.

If `robots.txt` exists and has no `Sitemap:` line, one is appended. Without `robots.txt`, the run logs the line to add instead of creating a file.

## Tag surgery

```js
snappy({
  asyncScriptTags: true,   // mark external scripts async
  removeScriptTags: false, // remove every script tag
  removeStyleTags: false,  // remove every style tag
  removeBlobs: true,       // remove stylesheet links pointing at dead blob: URLs
});
```

`removeScriptTags` keeps the persisted metadata element. Removing all scripts also removes hydration.

## Removing volatile markup

Mark elements that should not appear in the written HTML:

```jsx
<div data-prerender-remove>{ads.render()}</div>
```

Use this for ads, chat widgets or other markup that only exists after the client takes over. Do not remove markup the framework expects on its first client pass.

Some libraries stamp values that change on every load. Ant Design's `rc-menu`, for example, writes `data-menu-id="rc-menu-uuid-…"`. That rewrites every file and defeats `verifyChangedOnly`. Remove those attributes by name or RegExp:

```js
snappy({ removeAttributes: ['data-menu-id', 'aria-controls'] });
```

Only strip attributes the framework does not render as props.

## Strict CSP

`csp: 'off'` leaves injected scripts inline. `csp: 'strict'` makes the output work under `script-src 'self'` with no `unsafe-inline`.

| Piece | `off` | `strict` |
| --- | --- | --- |
| Head defaults | Inert `<script type="application/json" data-snappy-meta>` | Same |
| Captured state | Inline script before the bundle | Content-hashed same-origin file; routes sharing state share one file |
| Critical CSS swap | `media="print"` plus inline `onload` | No swap handlers; deferred stylesheets stay as links |

```js
snappy({ csp: 'strict' });
snappy({ csp: 'strict', criticalCssPreload: 'media' }); // keep the swap
snappy({ externalScripts: true });                     // adjust one piece
```

Two things remain even under `strict`:

- Inlined CSS, including critical CSS and captured runtime styles, is `<style>` text, so `style-src` needs an allowance.
- The app bundle is still an ordinary external script.

## Third-party requests

Third-party requests are allowed by default. Most SPA sites load data from a CMS, API or separate origin, and blocking those during prerendering produces empty pages.

```js
snappy({ blockThirdParty: false });                    // default
snappy({ blockThirdParty: true });                     // abort third-party requests
snappy({ blockThirdParty: true, allowedHosts: ['cms.example.com'] });
```

Blocking makes rendering deterministic and prevents analytics, ads and chat widgets from running during a build. `allowedHosts` keeps selected hosts reachable. Preconnect hints are still generated for every third-party origin; set `preconnectThirdParty: false` to disable them. The CLI flag is `--block-third-party`.

## CSS-in-JS

Emotion, styled-components, vanilla-extract, stitches and JSS work when their styles end up as text in a `<style>` tag. These cases need extra handling:

- **CSSOM-only styles.** Production emotion and styled-components v5 use `CSSStyleSheet.insertRule`, leaving the style element empty in the DOM. `captureRuntimeStyles` (default `true`) copies those rules back into the element and folds `document.adoptedStyleSheets` into a `<style>` tag.
- **Blob stylesheets.** `blob:` URLs die with the page. `removeBlobs` (default `true`) drops those links, and `inlineCss: 'inline'` inlines their content instead.
- **Duplicate styles.** Identical `<style>` contents in the head are de-duplicated. A runtime that re-inserts the same CSS on the client changes nothing visually and does not cause a hydration error.
- **Shadow DOM.** Content inside shadow roots is not captured. Use declarative shadow DOM or render those parts into the light DOM.

Both `inlineCss` strategies work with CSS-in-JS output. The hydration verifier catches runtimes that render differently on the client.

## Form state

Controlled inputs keep state as DOM properties, which do not survive serialisation. `captureFormState` (default `true`) writes `checked` and `selected` attributes to match the live DOM and clears them when the property is false.

`input.indeterminate` has no attribute and cannot be captured. Restore it in the app after hydration.

## Async data and state

Hydration mismatches often come from data present during prerender but missing on the client. Two mechanisms close that gap.

### Cached JSON

```js
snappy({ cacheAjaxRequests: true });
```

```js
const cached = window.snapStore?.['/api/items?page=2'];
if (cached) return cached;
return fetch('/api/items?page=2').then((response) => response.json());
```

`window.snapStore` is keyed by request path and query string. Responses larger than `maxCachedBytes` (default 5 MiB) are skipped.

### App state

Define `window.snapSaveState` and its return value is injected as globals before the first script:

```js
window.snapSaveState = () => ({ __APP_STATE__: store.getState() });
// becomes: window.__APP_STATE__ = {...}
```

Values are JSON-encoded with `<`, `>`, `/` and line separators escaped, so state cannot break out of the script tag.

## Screenshots

```js
snappy({ saveAs: 'png', destination: 'build/screenshots' });
```

`saveAs: 'png'` or `'jpeg'` captures a full-page screenshot per route instead of HTML: `index.png`, `about.png`, `blog/post.png`. Hydration verification is skipped because there is no HTML to verify.

## Writing elsewhere

```js
snappy({ destination: 'build/prerendered' });
```

The run copies the build to the destination first, so assets sit beside the generated HTML and the source stays untouched. It reports existing files before overwriting them.
