import { collectBuildOrigins } from '../core/metadata-origin.js';

const ABSOLUTE = /^https?:\/\//i;
const PROTOCOL_RELATIVE = /^\/\//;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SINGLETON_LINK_RELS = new Set(['canonical']);

/**
 * Turns component props plus project defaults into the tag list the document head should
 * hold: title, description, robots, canonical, Open Graph and Twitter card. Values the
 * caller did not supply are simply absent, so the component never invents metadata the app
 * did not ask for.
 */
export function buildHeadEntries(props = {}, defaults = {}) {
  const entries = [];
  const template = props.titleTemplate ?? defaults.titleTemplate ?? null;
  const siteName = props.siteName ?? defaults.siteName ?? null;
  const image = props.image ?? defaults.defaultImage ?? null;

  const title = props.title ? applyTitleTemplate(props.title, template, siteName) : null;
  if (title) entries.push({ kind: 'title', text: title });
  if (title && props.openGraph !== false) entries.push(metaProp('og:title', title));
  if (title && props.twitter !== false) entries.push(metaName('twitter:title', title));

  if (props.description) {
    entries.push(metaName('description', props.description));
    if (props.openGraph !== false) entries.push(metaProp('og:description', props.description));
    if (props.twitter !== false) entries.push(metaName('twitter:description', props.description));
  }

  if (props.robots) entries.push(metaName('robots', props.robots));

  if (props.openGraph !== false) {
    entries.push(metaProp('og:type', props.type ?? 'website'));
    if (siteName) entries.push(metaProp('og:site_name', siteName));
    if (props.locale) entries.push(metaProp('og:locale', props.locale));
    const url = pageUrl(props.canonical ?? currentPath(), defaults);
    if (url) entries.push(metaProp('og:url', url));
    if (image) entries.push(metaProp('og:image', absoluteUrl(image, defaults)));
  }

  if (props.twitter !== false) {
    entries.push(metaName('twitter:card', image ? 'summary_large_image' : 'summary'));
    if (image) entries.push(metaName('twitter:image', absoluteUrl(image, defaults)));
  }

  if (props.canonical !== false) {
    const url = pageUrl(props.canonical ?? currentPath(), defaults);
    if (url)
      entries.push({ kind: 'link', key: 'rel:canonical', attrs: { rel: 'canonical', href: url } });
  }

  for (const extra of props.extra ?? []) entries.push(extraEntry(extra));

  return entries;
}

/**
 * Merges every mounted Head into one tag list. Later entries win per tag key, and the
 * render order recorded by each component decides "later", so a page's Head overrides the
 * layout's Head rather than the other way around.
 */
export function mergeHeadEntries(stack = []) {
  const merged = new Map();
  for (const item of [...stack].sort((a, b) => a.sequence - b.sequence)) {
    for (const entry of item.entries) merged.set(headKey(entry), entry);
  }
  const values = [...merged.values()];
  const titles = values.filter((entry) => entry.kind === 'title');
  const rest = values.filter((entry) => entry.kind !== 'title');
  return [...titles, ...sortMetasFirst(rest)];
}

/**
 * Identifies a tag by what a browser or crawler matches on, not by who wrote it, so an
 * existing tag is updated in place rather than duplicated.
 */
export function headKey(entry) {
  if (entry.kind === 'title') return 'title';
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

/**
 * Collects the absolute metadata URLs in a document that point at the machine the
 * prerenderer ran on, which happens when no public siteUrl was configured.
 */
export function findBuildOriginUrls(html) {
  return collectBuildOrigins(html);
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

// Applies the site's trailing slash convention to a URL, leaving the root alone.
function withTrailingSlash(url, convention) {
  if (convention !== 'always' && convention !== 'never') return url;
  const [path, query] = url.split('?');
  const isRoot = /^https?:\/\/[^/]+\/?$/i.test(path);
  if (convention === 'always') {
    const next = path.endsWith('/') ? path : `${path}/`;
    return query ? `${next}?${query}` : next;
  }
  if (isRoot) return query ? `${path.replace(/\/$/, '/')}?${query}` : path.replace(/\/?$/, '/');
  const next = path.replace(/\/+$/, '');
  return query ? `${next}?${query}` : next;
}

// Reads the route being rendered, which under prerendering is the page being captured.
function currentPath() {
  return typeof location === 'undefined' ? '/' : location.pathname;
}

function metaName(name, content) {
  return { kind: 'meta', key: `name:${name}`, attrs: { name, content } };
}

function metaProp(property, content) {
  return { kind: 'meta', key: `property:${property}`, attrs: { property, content } };
}

// Builds an entry from the caller's escape hatch for tags the model does not cover.
function extraEntry(extra) {
  const attrs = { ...extra };
  delete attrs.key;
  const kind = attrs.rel && !attrs.content ? 'link' : 'meta';
  const key = extra.key ?? (kind === 'link' ? linkKey(attrs) : identityKey(attrs));
  return { kind, key, attrs };
}

// Keys a meta tag the same way the model keys its own, so a later Head can override it
// instead of adding a duplicate.
function identityKey(attrs) {
  if (attrs.name) return `name:${attrs.name}`;
  if (attrs.property) return `property:${attrs.property}`;
  if (attrs['http-equiv']) return `http-equiv:${attrs['http-equiv']}`;
  return attrsKey(attrs);
}

// Keys a link by rel, plus href for every rel a page may legitimately use more than once
// (preload, alternate, icon). Only singleton rels collapse to one tag per document.
function linkKey(attrs) {
  const rel = String(attrs.rel);
  if (SINGLETON_LINK_RELS.has(rel.toLowerCase()) || !attrs.href) return `rel:${rel}`;
  return `rel:${rel}|${attrs.href}`;
}

function attrsKey(attrs) {
  return Object.entries(attrs)
    .map(([name, value]) => `${name}=${value}`)
    .join('|');
}

function attrsValue(attrs = {}, name) {
  return attrs[name];
}

// Keeps output deterministic: title, then name/property metas, then links.
function sortMetasFirst(entries) {
  return [...entries].sort((a, b) => {
    const rank = (entry) => (entry.kind === 'meta' ? 0 : 1);
    return rank(a) - rank(b);
  });
}
