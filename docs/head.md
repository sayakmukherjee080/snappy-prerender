# Head and metadata

`snappy-prerender/head` sets titles, meta tags, canonicals, Open Graph, Twitter cards and JSON-LD at runtime. The prerenderer captures the result into each route's HTML.

## Usage

```jsx
import { Head } from 'snappy-prerender/head';

<Head
  title="Awards"
  description="Awards presented by the society"
  image="/share/awards.png"
  type="article"
  locale="en_GB"
  robots="index,follow"
  lang="en"
  dir="ltr"
  structuredData={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Awards' }}
  alternates={[
    { hreflang: 'en', href: '/awards' },
    { hreflang: 'x-default', href: '/awards' },
  ]}
  extra={[
    { name: 'keywords', content: 'polymer' },
    { rel: 'alternate', href: '/feed.xml' },
  ]}
/>
```

The component updates the document head on every render, including client-side navigation. The prerenderer captures the final head.

## Site defaults

Set project-wide values with `metadata`. The prerenderer injects them into every page so the head component can build absolute URLs from the public site, not the build server.

```js
snappy({
  metadata: {
    siteUrl: 'https://example.com',
    siteName: 'Example',
    titleTemplate: '%s | Example',
    defaultTitle: 'Example',
    defaultImage: '/share.png',
    trailingSlash: 'never', // 'preserve' | 'always' | 'never'
  },
});
```

`metadata` provides defaults; a `Head` prop wins. `siteUrl` must be an origin. Put a sub-path deployment in `base`.

## Replacing React Helmet

For React, `Head` covers the client-side tags React Helmet and React Helmet Async expose. No provider, server renderer or extra head package is needed. Other frameworks can use `setHead` and `clearHead`, or keep their own metadata layer.

```jsx
<Head
  title="Awards"
  titleAttributes={{ itemProp: 'name' }}
  htmlAttributes={{ className: 'theme-dark', 'data-theme': 'dark' }}
  bodyAttributes={{ className: 'root', 'data-scroll': 'locked' }}
  images={['/share/awards.png', '/share/awards-square.png']}
  alternateLocales={['en_GB', 'fr_FR']}
  tags={[
    { tag: 'base', attrs: { href: '/' } },
    { tag: 'script', attrs: { src: '/analytics.js', async: true } },
    { tag: 'script', attrs: { type: 'application/json' }, text: '{"feature":true}' },
    { tag: 'style', attrs: { media: 'screen' }, text: 'body { color: #111 }' },
    { tag: 'noscript', html: '<img src="/pixel.png" alt="">' },
  ]}
  onChangeClientState={(state, added, removed) => {}}
/>
```

`Head` does not accept JSX children. Use props, `extra` or `tags`.

### Tags

`tags` accepts `script`, `style`, `noscript` and `base`.

- `attrs` takes arbitrary attributes. `true` emits an empty attribute; `false`, `null` and `undefined` omit it. React spellings such as `className`, `htmlFor` and `httpEquiv` map to DOM names.
- `text` sets `textContent` for `script`, `style` and `noscript`. Closing-tag sequences are escaped so they cannot terminate the element.
- `html` sets trusted `innerHTML` on `noscript` only. Never pass untrusted input.
- `key` gives a tag an explicit identity. Without one, external scripts key by `src` and inline tags key per mounted `Head`.
- `base` is a singleton; the last mounted `Head` that sets one wins.

`htmlAttributes`, `bodyAttributes` and `titleAttributes` write arbitrary attributes on the document element, body and title. Existing values return when no Head wants them. `lang` and `dir` are shortcuts; an `htmlAttributes` entry wins when both are supplied.

`defaultTitle` fills the title only when no mounted Head supplied one. It is not run through `titleTemplate`.

`images` emits one `og:image` per URL and uses the first for `twitter:image`. `alternateLocales` emits one `og:locale:alternate` per value.

`extra` adds `meta` and `link` tags. Set `duplicates: true` on repeated same-name metas such as `article:tag`.

`onChangeClientState(state, added, removed)` runs after a real DOM change. `state` groups entries into `title`, `meta`, `link`, `script`, `style`, `noscript`, `base`, `htmlAttributes`, `bodyAttributes` and `titleAttributes`. `added` and `removed` are descriptors with `kind`, `key` and value.

## Output and merge rules

- Each route emits `title`, `meta[name=description]`, `meta[name=robots]`, `link[rel=canonical]`, `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`, `og:locale` and `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
- Disable a family with `openGraph: false` or `twitter: false`. Disable the canonical with `canonical: false`.
- Tags are matched by the attribute a crawler reads, so existing tags are updated instead of duplicated. Images, alternate locales, scripts and styles keep value-specific identities so multiples survive.
- When several Heads render, the last one wins per tag.
- Generated tags carry `data-snappy-head` and `data-snappy-head-created`, so a later page load can distinguish them from app-written tags.
- When no Head wants a tag, generated tags are removed and app-written tags are restored to their previous value after navigation and hydration.
- The title template is skipped when the title already ends with its fixed part, is the site name, or has no real title.
- `structuredData` emits one `application/ld+json` script per object or array entry. Values are escaped; add `@context` when needed.
- `alternates` emits `<link rel="alternate" hreflang="...">` with the same `siteUrl`, `base` and `trailingSlash` policy as canonical links. The same alternates feed sitemap `xhtml:link` entries.
- Canonical, social and sitemap URLs share one page-path policy. Directory output keeps its slash, flat output stays extensionless, and `trailingSlash` wins. Explicit URLs keep their fragment.
- `metadata.base` overrides the base path used for absolute URLs and defaults to `base`.
- Without `metadata.siteUrl`, build-server URLs are removed by default and the run warns.
- The component renders nothing and does not affect hydration of page content.
- React 19 hoists native `<title>`, `<meta>` and `<link>` elements. `Head` adopts a matching hoisted node and updates it in place. When app-owned and hoisted copies both exist, the newest matching node is updated and older duplicates are released. A hoisted title with the Head text is left untouched so React can remove it on navigation. Use one metadata system; the run warns when a page ships more than one `<title>`.
- Every metadata value has a CLI flag: `--metadata-site-url`, `--metadata-site-name`, `--metadata-title-template`, `--metadata-default-image` and `--metadata-trailing-slash`.

## Imperative API

React apps import `Head`. Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla code can call `setHead(id, props)` and `clearHead(id)`.

`react` is an optional peer dependency for this entry point.

The entry is plain JavaScript with JSDoc types for `HeadProps`, `HeadTag`, `HeadAttributes`, `HeadChange` and the imperative API. It has no TypeScript files.

This is a client-side head manager. It deliberately has no `HelmetProvider`, `helmetContext`, `HelmetData`, `renderStatic()`, streaming or server rendering API. The prerenderer runs the real app in a browser and captures the live head.
