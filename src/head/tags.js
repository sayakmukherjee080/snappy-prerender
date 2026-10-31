import { pagePath, withTrailingSlash } from '../core/url-policy.js';

const ABSOLUTE = /^https?:\/\//i;
const PROTOCOL_RELATIVE = /^\/\//;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SINGLETON_LINK_RELS = new Set(['canonical']);
const ALLOWED_HEAD_TAGS = new Set(['script', 'style', 'noscript', 'base']);
const RESERVED_ATTRIBUTES = new Set(['data-snappy-head', 'data-snappy-head-created']);
const ATTRIBUTE_NAME = /^[^\s"'<>/=]+$/;

// React prop names callers use in JSX, mapped to the attribute names the DOM stores. Helmet
// accepts the same spellings, so a migration does not need to rewrite attribute objects.
const ATTRIBUTE_ALIASES = Object.freeze({
  acceptCharset: 'accept-charset',
  charSet: 'charset',
  className: 'class',
  crossOrigin: 'crossorigin',
  htmlFor: 'for',
  httpEquiv: 'http-equiv',
  itemID: 'itemid',
  itemProp: 'itemprop',
  itemRef: 'itemref',
  itemScope: 'itemscope',
  itemType: 'itemtype',
  noModule: 'nomodule',
  referrerPolicy: 'referrerpolicy',
  srcSet: 'srcset',
});

/**
 * Turns component props plus project defaults into the tag list the document head should
 * hold: title, description, robots, canonical, Open Graph and Twitter card. Values the
 * caller did not supply are simply absent, so the component never invents metadata the app
 * did not ask for.
 */
export function buildHeadEntries(props = {}, defaults = {}, id = 'default') {
  if (props.children !== undefined && props.children !== null && props.children !== false) {
    throw new TypeError('Head does not accept children; use tags, extra or the metadata props');
  }
  const entries = [];
  const template = props.titleTemplate ?? defaults.titleTemplate ?? null;
  const siteName = props.siteName ?? defaults.siteName ?? null;

  if (typeof props.lang === 'string' && props.lang.length > 0) {
    entries.push({ kind: 'html', key: 'lang', value: props.lang });
  }
  if (props.dir === 'ltr' || props.dir === 'rtl' || props.dir === 'auto') {
    entries.push({ kind: 'html', key: 'dir', value: props.dir });
  }
  // Attribute objects are pushed after the shortcuts so htmlAttributes.lang and
  // htmlAttributes.dir win when both spellings are supplied.
  entries.push(...attributeEntries('html', props.htmlAttributes, 'htmlAttributes'));
  entries.push(...attributeEntries('body', props.bodyAttributes, 'bodyAttributes'));
  entries.push(...attributeEntries('titleAttribute', props.titleAttributes, 'titleAttributes'));

  const title = props.title ? applyTitleTemplate(String(props.title), template, siteName) : null;
  if (title) entries.push({ kind: 'title', text: title });
  const defaultTitle = props.defaultTitle ?? defaults.defaultTitle ?? null;
  if (!title && defaultTitle !== null && defaultTitle !== undefined && defaultTitle !== '') {
    entries.push({ kind: 'defaultTitle', text: String(defaultTitle) });
  }
  if (title && props.openGraph !== false) entries.push(metaProp('og:title', title));
  if (title && props.twitter !== false) entries.push(metaName('twitter:title', title));

  if (props.description) {
    entries.push(metaName('description', props.description));
    if (props.openGraph !== false) entries.push(metaProp('og:description', props.description));
    if (props.twitter !== false) entries.push(metaName('twitter:description', props.description));
  }

  if (props.robots) entries.push(metaName('robots', props.robots));

  const images = resolveImages(props, defaults);
  if (props.openGraph !== false) {
    entries.push(metaProp('og:type', props.type ?? 'website'));
    if (siteName) entries.push(metaProp('og:site_name', siteName));
    if (props.locale) entries.push(metaProp('og:locale', props.locale));
    for (const locale of normaliseStringList(props.alternateLocales, 'alternateLocales')) {
      entries.push(metaDuplicate('property', 'og:locale:alternate', locale));
    }
    const url = pageUrl(props.canonical ?? defaultPagePath(defaults), defaults);
    if (url) entries.push(metaProp('og:url', url));
    images.forEach((image, index) => {
      entries.push(imageMeta(image, index, images.length));
    });
  }

  if (props.twitter !== false) {
    entries.push(metaName('twitter:card', images.length > 0 ? 'summary_large_image' : 'summary'));
    if (images.length > 0) entries.push(metaName('twitter:image', images[0]));
  }

  if (props.canonical !== false) {
    const url = pageUrl(props.canonical ?? defaultPagePath(defaults), defaults);
    if (url) {
      entries.push({
        kind: 'link',
        key: 'rel:canonical',
        match: [['rel', 'canonical']],
        attrs: { rel: 'canonical', href: url },
      });
    }
  }

  for (const alternate of props.alternates ?? []) {
    const href = pageUrl(alternate.href, defaults);
    const hreflang = alternate.hreflang ?? alternate.lang;
    if (!href || !hreflang) continue;
    const attrs = normaliseAttributes(
      {
        rel: 'alternate',
        hreflang,
        href,
        ...(alternate.type ? { type: alternate.type } : {}),
      },
      'alternates[].attrs',
    );
    entries.push({ kind: 'link', key: linkKey(attrs), match: linkMatch(attrs), attrs });
  }

  if (props.structuredData !== undefined && props.structuredData !== null) {
    entries.push({
      kind: 'script',
      key: `script:ld+json:${id}`,
      attrs: { type: 'application/ld+json' },
      text: serializeStructuredData(props.structuredData),
    });
  }

  const tags = normaliseTags(props.tags);
  tags.forEach((tag, index) => {
    entries.push(headTagEntry(tag, id, index));
  });

  for (const extra of props.extra ?? []) entries.push(extraEntry(extra));

  return entries;
}

/**
 * Merges every mounted Head into one tag list. Later entries win per tag key, and the
 * render order recorded by each component decides "later", so a page's Head overrides the
 * layout's Head rather than the other way around. A defaultTitle only fills the document
 * title when no mounted Head supplied a real title.
 */
export function mergeHeadEntries(stack = []) {
  const merged = new Map();
  for (const item of [...stack].sort((a, b) => a.sequence - b.sequence)) {
    for (const entry of item.entries) merged.set(headKey(entry), entry);
  }
  const values = [...merged.values()];
  const title = values.find((entry) => entry.kind === 'title') ?? null;
  const fallback = values.find((entry) => entry.kind === 'defaultTitle') ?? null;
  const resolvedTitle = title ?? (fallback ? { kind: 'title', text: fallback.text } : null);
  const rest = values.filter((entry) => entry.kind !== 'title' && entry.kind !== 'defaultTitle');
  return [...(resolvedTitle ? [resolvedTitle] : []), ...sortHeadOrder(rest)];
}

/**
 * Identifies a tag by what a browser or crawler matches on, not by who wrote it, so an
 * existing tag is updated in place rather than duplicated. Entries that must keep several
 * values in parallel carry their own key, which includes the value that makes them unique.
 */
export function headKey(entry) {
  if (entry.kind === 'title') return 'title';
  if (entry.kind === 'defaultTitle') return 'default-title';
  if (entry.kind === 'html') return `html:${entry.key}`;
  if (entry.kind === 'body') return `body:${entry.key}`;
  if (entry.kind === 'titleAttribute') return `title-attr:${entry.key}`;
  if (entry.kind === 'script') return entry.key;
  if (entry.kind === 'style' || entry.kind === 'noscript' || entry.kind === 'base') {
    return entry.key;
  }
  if (entry.kind === 'link') return `link:${entry.key ?? attrsKey(entry.attrs)}`;
  if (entry.key) return `meta:${entry.key}`;
  const name = attrsValue(entry.attrs, 'name');
  if (name) return `meta:name:${name}`;
  const property = attrsValue(entry.attrs, 'property');
  if (property) return `meta:property:${property}`;
  const httpEquiv = attrsValue(entry.attrs, 'http-equiv');
  if (httpEquiv) return `meta:http-equiv:${httpEquiv}`;
  return `meta:${attrsKey(entry.attrs)}`;
}

// Applies the site's title template unless the title already carries its suffix or is the
// site name itself, so an app that composed its own title never gets it suffixed twice.
function applyTitleTemplate(title, template, siteName) {
  if (!template || !template.includes('%s')) return title;
  if (alreadyTemplated(title, template, siteName)) return title;
  return template.replaceAll('%s', title);
}

// Reports whether the title already ends with the template's fixed part, compared as a
// whole suffix rather than a substring, so a site name inside a title does not skip it.
function alreadyTemplated(title, template, siteName) {
  if (siteName && title === siteName) return true;
  const suffix = template.replaceAll('%s', '').trim();
  return suffix.length > 0 && title.endsWith(suffix);
}

// Resolves a metadata URL. Protocol-relative and non-http values stay as given, paths are
// resolved against the public site URL, and spaces are encoded so the value is a valid URL.
function absoluteUrl(value, defaults) {
  if (!value) return null;
  const raw = String(value);
  if (ABSOLUTE.test(raw) || PROTOCOL_RELATIVE.test(raw) || URL_SCHEME.test(raw)) {
    return encodeSpaces(raw);
  }
  const base = defaults.siteUrl ?? (typeof location === 'undefined' ? null : location.origin);
  if (!base) return null;
  const prefix = defaults.base && defaults.base !== '/' ? defaults.base.replace(/\/$/, '') : '';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return encodeSpaces(`${base.replace(/\/$/, '')}${prefix}${path}`);
}

// Resolves a page URL and applies the trailing slash convention to it. Asset URLs never go
// through this, because a file path must not gain or lose a slash.
function pageUrl(value, defaults) {
  const url = absoluteUrl(value, defaults);
  return url ? withTrailingSlash(url, defaults.trailingSlash) : null;
}

// Encodes space characters so a value pasted into metadata still serialises as a valid URL.
function encodeSpaces(url) {
  return url.replace(/ /g, '%20');
}

// Reads the route being rendered, which under prerendering is the page being captured,
// and removes the public base path so absoluteUrl does not add it a second time.
function currentPath(defaults = {}) {
  const pathname = typeof location === 'undefined' ? '/' : location.pathname;
  const base = defaults.base ?? '/';
  if (base === '/') return pathname;
  const prefix = base.replace(/\/$/, '');
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

// Builds the default canonical path from the current route and the output's URL policy.
function defaultPagePath(defaults) {
  return pagePath(currentPath(defaults), {
    flatOutput: defaults.flatOutput === true,
    trailingSlash: defaults.trailingSlash,
  });
}

// Resolves the single image or the ordered image list used by Open Graph and Twitter.
function resolveImages(props, defaults) {
  const requested =
    props.images !== undefined ? props.images : [props.image ?? defaults.defaultImage];
  if (!Array.isArray(requested)) throw new TypeError('images must be an array of URLs');
  const resolved = [];
  for (const value of requested) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string') throw new TypeError('images entries must be strings');
    const url = absoluteUrl(value, defaults);
    if (url) resolved.push(url);
  }
  return resolved;
}

// Builds one Open Graph image entry. The first image keeps the plain identity key so a
// single image still updates an existing tag in place; parallel images carry their URL in
// the key so every value survives the merge.
function imageMeta(url, index, total) {
  if (total === 1) return metaProp('og:image', url);
  if (index === 0) {
    return {
      kind: 'meta',
      key: 'property:og:image',
      match: [
        ['property', 'og:image'],
        ['content', url],
      ],
      adopt: [['property', 'og:image']],
      attrs: { property: 'og:image', content: url },
    };
  }
  return metaDuplicate('property', 'og:image', url);
}

// Builds a meta tag that may legitimately appear more than once, keyed by its content.
function metaDuplicate(attribute, identity, content) {
  return {
    kind: 'meta',
    key: `${attribute}:${identity}|content=${content}`,
    match: [
      [attribute, identity],
      ['content', content],
    ],
    attrs: { [attribute]: identity, content },
  };
}

// Builds a single meta tag identified by its name attribute.
function metaName(name, content) {
  return {
    kind: 'meta',
    key: `name:${name}`,
    match: [['name', name]],
    attrs: { name, content },
  };
}

// Builds a single meta tag identified by its property attribute.
function metaProp(property, content) {
  return {
    kind: 'meta',
    key: `property:${property}`,
    match: [['property', property]],
    attrs: { property, content },
  };
}

// Builds an entry from the caller's escape hatch for tags the model does not cover. A
// duplicates flag gives the entry a value-specific key so repeated same-name tags survive.
function extraEntry(extra) {
  const duplicates = extra.duplicates === true;
  const attrs = { ...extra };
  delete attrs.key;
  delete attrs.duplicates;
  const kind = attrs.rel && !attrs.content ? 'link' : 'meta';
  const key = extra.key ?? (kind === 'link' ? linkKey(attrs) : identityKey(attrs, duplicates));
  const match = kind === 'link' ? linkMatch(attrs) : metaMatch(attrs, duplicates);
  return { kind, key, match, attrs };
}

// Keys a meta tag the same way the model keys its own, so a later Head can override it
// instead of adding a duplicate.
function identityKey(attrs, duplicates = false) {
  let key;
  if (attrs.name) key = `name:${attrs.name}`;
  else if (attrs.property) key = `property:${attrs.property}`;
  else if (attrs['http-equiv']) key = `http-equiv:${attrs['http-equiv']}`;
  else key = attrsKey(attrs);
  return duplicates ? `${key}|${attrsKey(attrs)}` : key;
}

// Keys a link by rel, plus href for every rel a page may legitimately use more than once
// (preload, alternate, icon). Only singleton rels collapse to one tag per document.
function linkKey(attrs) {
  const rel = String(attrs.rel);
  if (SINGLETON_LINK_RELS.has(rel.toLowerCase()) || !attrs.href) return `rel:${rel}`;
  const parts = [`rel:${rel}`];
  if (attrs.hreflang) parts.push(attrs.hreflang);
  parts.push(attrs.href);
  return parts.join('|');
}

// Describes the attributes that identify a link for adoption. Canonical links match on rel
// alone so a new URL updates the existing tag instead of adding a second one.
function linkMatch(attrs) {
  const rel = String(attrs.rel);
  const pairs = [['rel', rel]];
  if (!SINGLETON_LINK_RELS.has(rel.toLowerCase()) && attrs.href) {
    pairs.push(['href', attrs.href]);
    if (attrs.hreflang) pairs.push(['hreflang', attrs.hreflang]);
  }
  return pairs;
}

// Describes the attributes that identify a meta tag. Duplicate-capable tags also match on
// every other supplied attribute so each value keeps its own element.
function metaMatch(attrs, duplicates = false) {
  const pairs = [];
  if (attrs.name) pairs.push(['name', attrs.name]);
  else if (attrs.property) pairs.push(['property', attrs.property]);
  else if (attrs['http-equiv']) pairs.push(['http-equiv', attrs['http-equiv']]);
  if (!duplicates) return pairs;
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'name' || name === 'property' || name === 'http-equiv') continue;
    pairs.push([name, value]);
  }
  return pairs;
}

// Validates and normalises the tags escape hatch.
function normaliseTags(tags) {
  if (tags === undefined || tags === null) return [];
  if (!Array.isArray(tags)) throw new TypeError('tags must be an array');
  return tags.map((tag, index) => {
    if (typeof tag !== 'object' || tag === null || Array.isArray(tag)) {
      throw new TypeError(`tags[${index}] must be an object`);
    }
    if (!ALLOWED_HEAD_TAGS.has(tag.tag)) {
      throw new TypeError(`tags[${index}].tag must be one of ${[...ALLOWED_HEAD_TAGS].join(', ')}`);
    }
    if (tag.html !== undefined && tag.tag !== 'noscript') {
      throw new TypeError(`tags[${index}].html is only supported on noscript`);
    }
    if (
      tag.text !== undefined &&
      tag.text !== null &&
      !['script', 'style', 'noscript'].includes(tag.tag)
    ) {
      throw new TypeError(`tags[${index}].text is only supported on script, style and noscript`);
    }
    if (tag.key !== undefined && (typeof tag.key !== 'string' || tag.key.length === 0)) {
      throw new TypeError(`tags[${index}].key must be a non-empty string`);
    }
    return tag;
  });
}

// Builds one script, style, noscript or base entry. Inline tags get a stable key scoped to
// the mounted Head so several of them can coexist; external scripts key by src.
function headTagEntry(tag, id, index) {
  const attrs = normaliseAttributes(tag.attrs, `tags[${index}].attrs`);
  const text = tag.text === undefined || tag.text === null ? undefined : String(tag.text);
  const html = tag.html === undefined || tag.html === null ? undefined : String(tag.html);
  let key;
  if (tag.tag === 'base') key = 'base';
  else if (tag.key) key = `${tag.tag}:key:${tag.key}`;
  else if (tag.tag === 'script' && attrs.src) key = `script:src:${attrs.src}`;
  else key = `${tag.tag}:inline:${id}:${index}`;
  const entry = { kind: tag.tag, key, attrs };
  if (text !== undefined) {
    entry.text =
      tag.tag === 'script' || tag.tag === 'style' ? escapeClosingTag(text, tag.tag) : text;
  }
  if (html !== undefined) entry.html = html;
  return entry;
}

// Escapes a closing-tag sequence so a script or style value cannot terminate its own
// element. The backslash stays valid in JavaScript strings and CSS.
function escapeClosingTag(text, tag) {
  return text.replace(new RegExp(`</${tag}`, 'gi'), (match) => `<\\/${match.slice(2)}`);
}

// Validates an attribute object and converts it to DOM attribute strings. Boolean true
// emits an empty attribute; false and null omit the attribute entirely.
function normaliseAttributes(attrs, context) {
  if (attrs === undefined || attrs === null) return {};
  if (typeof attrs !== 'object' || Array.isArray(attrs)) {
    throw new TypeError(`${context} must be an object`);
  }
  const normalised = {};
  for (const [rawName, rawValue] of Object.entries(attrs)) {
    if (RESERVED_ATTRIBUTES.has(rawName)) {
      throw new TypeError(`${context}.${rawName} is reserved by the head manager`);
    }
    if (!ATTRIBUTE_NAME.test(rawName)) {
      throw new TypeError(`${context} contains an invalid attribute name: ${rawName}`);
    }
    const name = ATTRIBUTE_ALIASES[rawName] ?? rawName;
    const value = normaliseAttributeValue(rawValue, `${context}.${rawName}`);
    if (value === null) continue;
    normalised[name] = value;
  }
  return normalised;
}

// Converts one attribute value, rejecting objects and functions instead of stringifying
// them into meaningless markup.
function normaliseAttributeValue(value, name) {
  if (value === false || value === null || value === undefined) return null;
  if (value === true) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new TypeError(`${name} must be a string, number, boolean, null or undefined`);
}

// Expands html, body and title attribute objects into mergeable attribute entries.
function attributeEntries(kind, attributes, context) {
  const normalised = normaliseAttributes(attributes, context);
  return Object.entries(normalised).map(([key, value]) => ({ kind, key, value }));
}

// Validates a list of strings, returning an empty list when the option is absent.
function normaliseStringList(list, name) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new TypeError(`${name} must be an array`);
  for (const value of list) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`${name} entries must be non-empty strings`);
    }
  }
  return list;
}

// Joins every attribute into a stable key, used when an entry has no simpler identity.
function attrsKey(attrs) {
  return Object.entries(attrs)
    .map(([name, value]) => `${name}=${value}`)
    .join('|');
}

// Reads one attribute value from a plain attribute object.
function attrsValue(attrs = {}, name) {
  return attrs[name];
}

// Serialises JSON-LD so a value can never close the script element. The escapes remain
// valid JSON, so crawlers parse the same object the caller supplied.
function serializeStructuredData(value) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (char) =>
      ({
        '<': '\\u003C',
        '>': '\\u003E',
        '&': '\\u0026',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029',
      })[char],
  );
}

// Keeps output deterministic: title, base, metas, links, scripts, styles, then noscript.
function sortHeadOrder(entries) {
  const rank = (entry) => {
    if (entry.kind === 'base') return 0;
    if (entry.kind === 'meta') return 1;
    if (entry.kind === 'link') return 2;
    if (entry.kind === 'script') return 3;
    if (entry.kind === 'style') return 4;
    if (entry.kind === 'noscript') return 5;
    return 6;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b));
}
