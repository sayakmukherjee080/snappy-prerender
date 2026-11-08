# Locales and hreflang

Path-prefixed and single-locale builds, hreflang alternates, and cookie or localStorage locale seeding for SEO.

## Path and single-locale modes

`locales` adds language metadata driven by config. Manual `Head` props still win; generated tags only fill missing values.

```js
snappy({
  locales: {
    mode: 'path',
    default: 'en',
    xDefault: 'en',
    hreflang: true,
    list: [
      { code: 'en', prefix: '', htmlLang: 'en', ogLocale: 'en_US' },
      {
        code: 'fr',
        prefix: '/fr',
        htmlLang: 'fr',
        ogLocale: 'fr_FR',
        routes: { '/about': '/a-propos' },
      },
    ],
  },
});
```

In `path` mode, the default locale is crawled once and every locale variant is rendered from the same base routes. `routes` maps translated slugs, and each value is the path without the locale prefix.

In `single` mode, `active` selects the locale for this build and each `list[].url` supplies the other deployments for hreflang.

A locale entry can also set `locale`, `timezone`, `storageState`, `cookies` and `localStorage`.

### What the package emits

- `<html lang>` and `dir` when missing.
- Canonical URLs.
- `og:locale` and `og:locale:alternate`.
- Self, alternate and `x-default` hreflang links.
- The same alternates in sitemap `xhtml:link` entries.

`Head` also accepts `alternateLocales={['en_US', 'de_DE']}` for app-managed Open Graph tags.

The audit checks invalid and duplicate hreflang codes, missing self links, missing `x-default`, reciprocal links inside the same build, and an `<html lang>` that disagrees with the active locale.

Path mode needs one public origin and an app that routes the prefix or uses the translated `routes` map. Hreflang needs distinct crawlable URLs and absolute site URLs, so set `metadata.siteUrl`. A cookie-only locale does not create them. Use single mode for separate locale domains.

## Cookie and localStorage SEO locale

For apps whose locale lives in a cookie or `localStorage`, `seoLocale` selects the SEO language before the app boots:

```js
snappy({
  seoLocale: {
    code: 'fr',
    source: 'both',          // 'localStorage' | 'cookie' | 'both'
    localStorageKey: 'locale',
    cookie: { name: 'locale', path: '/', sameSite: 'Lax', secure: false },
    seedRender: true,
    seedVerification: true,
    inject: true,
    overwrite: true,
    forceHtmlLang: true,
    navigator: false,
    routes: ['/*'],
  },
});
```

`seedRender` and `seedVerification` set the value in the prerender and verification browsers. `inject` writes a small bootstrap before the app bundle so visitors get the same locale the static HTML was rendered in.

`overwrite: false` only sets the value when missing, preserving a visitor's existing choice. `forceHtmlLang` overrides an app-owned `<html lang>`. `navigator` also emulates `navigator.language` and `Accept-Language`.

In path mode the value comes from each locale's code. In single mode it comes from `locales.active` or `seoLocale.code`.

Under `csp: 'hash'`, the bootstrap is hashed with the other inline scripts. Under `csp: 'strict'` or `externalScripts`, it is written as a same-origin script. `inject: true` is rejected with `removeScriptTags: true` because the bootstrap would be stripped.

This option does not create crawlable URLs by itself. Single mode produces one locale per output. For multiple crawlable locales, use path-prefixed locales or separate builds and deployments. With `inject: false`, the HTML is localized but a visitor with different storage may see another locale after hydration.
