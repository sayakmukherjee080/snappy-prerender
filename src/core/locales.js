import { pagePath } from './url-policy.js';

const GENERATED_ATTRIBUTE = 'data-snappy-locale';

/**
 * Builds the locale plan for a run. A seoLocale without a locales matrix becomes a
 * synthetic single-locale plan so metadata and language attributes still work.
 * @param {object} config
 * @returns {object | null}
 */
export function buildLocalePlan(config) {
  if (config.locales) return config.locales;
  if (!config.seoLocale?.code) return null;
  const seo = config.seoLocale;
  return {
    mode: 'single',
    active: seo.code,
    default: seo.code,
    xDefault: false,
    hreflang: false,
    synthetic: true,
    list: [
      {
        code: seo.code,
        prefix: '',
        htmlLang: seo.htmlLang === true ? seo.code : (seo.htmlLang ?? seo.code),
        dir: seo.dir ?? null,
        locale: seo.navigator ? seo.code : null,
      },
    ],
  };
}

/**
 * Returns the locale record for a code.
 * @param {object} plan
 * @param {string} code
 * @returns {object | null}
 */
export function localeByCode(plan, code) {
  return plan?.list?.find((locale) => locale.code === code) ?? null;
}

/**
 * Returns the locale rendered by a single-mode run.
 * @param {object} plan
 * @returns {object | null}
 */
export function activeLocale(plan) {
  if (!plan) return null;
  if (plan.mode === 'single') return localeByCode(plan, plan.active ?? plan.default);
  return localeByCode(plan, plan.default);
}

/**
 * Joins a locale prefix and a route without producing duplicate slashes.
 * @param {string} prefix
 * @param {string} route
 * @returns {string}
 */
export function joinLocalePath(prefix, route) {
  const left = prefix === '/' ? '' : prefix;
  const right = route === '/' ? '' : route;
  const joined = `${left}${right}`;
  return joined.length === 0 ? '/' : joined.replace(/\/{2,}/g, '/');
}

/**
 * Maps a base route to the route a locale publishes.
 * @param {object} locale
 * @param {string} baseRoute
 * @returns {string}
 */
export function localeRoute(locale, baseRoute) {
  const mapped = locale.routes?.[baseRoute] ?? baseRoute;
  return joinLocalePath(locale.prefix ?? '', mapped);
}

/**
 * Removes a locale prefix from a route, returning the base route used for alternate
 * links and crawling.
 * @param {string} route
 * @param {object} locale
 * @returns {string}
 */
export function stripLocalePrefix(route, locale) {
  const prefix = locale.prefix ?? '';
  if (!prefix) return route;
  if (route === prefix) return '/';
  if (route.startsWith(`${prefix}/`)) return route.slice(prefix.length);
  return route;
}

/**
 * Reports whether a route belongs to a non-default locale and should not be crawled as a
 * base route in path mode.
 * @param {string} route
 * @param {object} plan
 * @returns {boolean}
 */
export function isLocalePrefixedRoute(route, plan) {
  if (!plan || plan.mode !== 'path') return false;
  const defaultLocale = localeByCode(plan, plan.default);
  return plan.list.some(
    (locale) =>
      locale.code !== plan.default &&
      locale.prefix &&
      locale.prefix !== defaultLocale?.prefix &&
      (route === locale.prefix || route.startsWith(`${locale.prefix}/`)),
  );
}

/**
 * Resolves the public URL for a base route in one locale.
 * @param {object} locale
 * @param {string} baseRoute
 * @param {object} config
 * @param {'path' | 'single'} mode
 * @returns {string | null}
 */
export function localePageUrl(locale, baseRoute, config, mode = 'path') {
  const base = locale.url ?? config.metadata?.siteUrl;
  if (!base) return null;
  const route =
    mode === 'single' ? (locale.routes?.[baseRoute] ?? baseRoute) : localeRoute(locale, baseRoute);
  const path = pagePath(route, {
    flatOutput: config.flatOutput,
    trailingSlash: config.metadata?.trailingSlash,
  });
  const prefix = config.base === '/' ? '' : config.base.slice(0, -1);
  return `${base.replace(/\/$/, '')}${prefix}${path}`;
}

/**
 * Builds the canonical URL, alternates and Open Graph locale values for one localized
 * page. Explicit app metadata is handled later; this describes the defaults the package
 * should fill.
 * @param {{ locale: object, baseRoute: string, plan: object, config: object }} input
 * @returns {object | null}
 */
export function buildLocaleLinks({ locale, baseRoute, plan, config }) {
  if (!locale || !plan) return null;
  const canonical = localePageUrl(locale, baseRoute, config, plan.mode);
  const alternates = [];
  if (plan.hreflang !== false) {
    for (const target of plan.list) {
      const href = localePageUrl(target, baseRoute, config, plan.mode);
      if (href) alternates.push({ hreflang: target.code, href });
    }
    const xDefault = plan.xDefault;
    if (xDefault === false) {
      // Explicitly disabled.
    } else if (typeof xDefault === 'string' && /^https?:\/\//.test(xDefault)) {
      alternates.push({ hreflang: 'x-default', href: xDefault });
    } else if (typeof xDefault === 'string') {
      const target = localeByCode(plan, xDefault);
      const href = target ? localePageUrl(target, baseRoute, config, plan.mode) : null;
      if (href) alternates.push({ hreflang: 'x-default', href });
    }
  }
  const ogAlternates = plan.list
    .filter((target) => target.code !== locale.code && target.ogLocale)
    .map((target) => target.ogLocale);
  return {
    htmlLang: locale.htmlLang ?? locale.code,
    dir: locale.dir ?? null,
    canonical,
    ogLocale: locale.ogLocale ?? null,
    ogAlternates,
    alternates,
    hreflang: plan.hreflang !== false,
  };
}

/**
 * Applies locale defaults to a parsed document. Generated tags carry a marker so a rerun
 * can replace them without touching metadata the app wrote. Existing app tags win.
 * @param {object} document parse5 document
 * @param {object} links result of buildLocaleLinks
 * @param {{ skipAlternates?: boolean, htmlLang?: string | boolean, dir?: string | null, forceHtmlLang?: boolean }} options
 */
export function applyLocaleMetadata(document, links, options = {}) {
  if (!links) return;
  const head = findHead(document);
  if (!head) return;
  removeGenerated(head);
  applyHtmlAttributes(document, links, options);
  applyCanonical(head, links);
  applyOpenGraph(head, links, options.skipAlternates === true);
  if (!options.skipAlternates && links.hreflang) applyAlternates(head, links.alternates);
}

/**
 * Writes generated html language and direction attributes while preserving app-owned
 * values unless a locale explicitly forces them.
 * @param {object} document
 * @param {object} links
 * @param {object} options
 */
function applyHtmlAttributes(document, links, options) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  if (!html) return;
  const lang =
    options.htmlLang === false
      ? null
      : typeof options.htmlLang === 'string'
        ? options.htmlLang
        : links.htmlLang;
  const generatedLang = attribute(html, 'data-snappy-locale-lang') === 'true';
  if (lang && (options.forceHtmlLang || !attribute(html, 'lang') || generatedLang)) {
    setAttribute(html, 'lang', lang);
    setAttribute(html, 'data-snappy-locale-lang', 'true');
  }
  const dir = options.dir ?? links.dir;
  const generatedDir = attribute(html, 'data-snappy-locale-dir') === 'true';
  if (dir && (!attribute(html, 'dir') || generatedDir)) {
    setAttribute(html, 'dir', dir);
    setAttribute(html, 'data-snappy-locale-dir', 'true');
  }
}

/**
 * Sets or replaces one attribute on a parse5 node.
 * @param {object} node
 * @param {string} name
 * @param {string} value
 */
function setAttribute(node, name, value) {
  const attrs = node.attrs ?? [];
  const existing = attrs.find((entry) => entry.name === name);
  if (existing) existing.value = value;
  else attrs.push({ name, value });
  node.attrs = attrs;
}

/**
 * Adds the locale canonical link when the app did not provide one.
 * @param {object} head
 * @param {object} links
 */
function applyCanonical(head, links) {
  if (!links.canonical) return;
  const existing = head.childNodes?.find(
    (node) => node.tagName === 'link' && attribute(node, 'rel').toLowerCase() === 'canonical',
  );
  if (existing) return;
  head.childNodes.push(
    linkNode([
      { name: 'rel', value: 'canonical' },
      { name: 'href', value: links.canonical },
      { name: GENERATED_ATTRIBUTE, value: 'canonical' },
    ]),
  );
}

/**
 * Adds Open Graph locale metadata without duplicating app-owned tags.
 * @param {object} head
 * @param {object} links
 * @param {boolean} skipAlternates
 */
function applyOpenGraph(head, links, skipAlternates) {
  if (links.ogLocale && !hasMeta(head, 'property', 'og:locale')) {
    head.childNodes.push(metaNode('property', 'og:locale', links.ogLocale));
  }
  if (skipAlternates) return;
  for (const locale of links.ogAlternates ?? []) {
    if (hasMeta(head, 'property', 'og:locale:alternate', locale)) continue;
    head.childNodes.push(metaNode('property', 'og:locale:alternate', locale));
  }
}

/**
 * Adds generated hreflang links, leaving an app-owned entry for the same code in place.
 * @param {object} head
 * @param {Array<{ hreflang: string, href: string }>} alternates
 */
function applyAlternates(head, alternates) {
  for (const alternate of alternates ?? []) {
    const existing = head.childNodes?.find(
      (node) =>
        node.tagName === 'link' &&
        node.attrs?.some(
          (entry) => entry.name === 'rel' && entry.value.toLowerCase() === 'alternate',
        ) &&
        node.attrs?.some(
          (entry) => entry.name === 'hreflang' && entry.value === alternate.hreflang,
        ),
    );
    if (existing) continue;
    head.childNodes.push(
      linkNode([
        { name: 'rel', value: 'alternate' },
        { name: 'hreflang', value: alternate.hreflang },
        { name: 'href', value: alternate.href },
        { name: GENERATED_ATTRIBUTE, value: `hreflang:${alternate.hreflang}` },
      ]),
    );
  }
}

/**
 * Removes locale tags generated by an earlier pass so a rerun can replace them.
 * @param {object} head
 */
function removeGenerated(head) {
  head.childNodes = (head.childNodes ?? []).filter(
    (node) => !node.attrs?.some((entry) => entry.name === GENERATED_ATTRIBUTE),
  );
}

/**
 * Reports whether the head already contains a meta tag with the given identity.
 * @param {object} head
 * @param {string} attributeName
 * @param {string} key
 * @param {string | null} content
 * @returns {boolean}
 */
function hasMeta(head, attributeName, key, content = null) {
  return (head.childNodes ?? []).some(
    (node) =>
      node.tagName === 'meta' &&
      attribute(node, attributeName) === key &&
      (content === null || attribute(node, 'content') === content),
  );
}

/**
 * Finds the document head in a parsed document.
 * @param {object} document
 * @returns {object | null}
 */
function findHead(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  return (html?.childNodes ?? []).find((node) => node.tagName === 'head') ?? null;
}

/**
 * Reads a parse5 node attribute.
 * @param {object} node
 * @param {string} name
 * @returns {string}
 */
function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

/**
 * Builds a parse5 link node.
 * @param {Array<{ name: string, value: string }>} attrs
 * @returns {object}
 */
function linkNode(attrs) {
  return {
    nodeName: 'link',
    tagName: 'link',
    attrs,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes: [],
    parentNode: null,
  };
}

/**
 * Builds a parse5 meta node with the generated marker.
 * @param {string} attributeName
 * @param {string} key
 * @param {string} content
 * @returns {object}
 */
function metaNode(attributeName, key, content) {
  return {
    nodeName: 'meta',
    tagName: 'meta',
    attrs: [
      { name: attributeName, value: key },
      { name: 'content', value: content },
      { name: GENERATED_ATTRIBUTE, value: `${key}:${content}` },
    ],
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes: [],
    parentNode: null,
  };
}
