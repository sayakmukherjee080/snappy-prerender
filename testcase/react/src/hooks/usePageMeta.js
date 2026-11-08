import { useEffect } from 'react';

const SITE_NAME = 'Aether Compute';
const PAGE_META_MARKER = 'data-page-meta';

/**
 * Creates or updates a single meta tag so each route can own its search and social preview text.
 * Tags created here carry a marker so a Head-owned route can remove only this hook's tags.
 * @param {'name' | 'property'} attribute
 * @param {string} key
 * @param {string} content
 */
function setMetaTag(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    tag.setAttribute(PAGE_META_MARKER, '');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Reads the metadata defaults from the inert JSON script the prerenderer writes, falling
 * back to the init-script global used during prerendering.
 * @returns {object}
 */
function readMetadataDefaults() {
  const element = document.querySelector('script[data-snappy-meta]');
  if (element) {
    try {
      return JSON.parse(element.textContent) ?? {};
    } catch {
      return {};
    }
  }
  return window.__SNAPPY_META__ ?? {};
}

/**
 * Applies the page title, description, canonical URL and robots policy for the active route.
 * A not-found page removes the canonical so it never advertises a path that does not exist.
 * A head-only route disables this hook so the package Head component owns metadata.
 * @param {{ title: string, description: string, noindex?: boolean, notFound?: boolean, enabled?: boolean }} metadata
 */
export function usePageMeta({
  title,
  description,
  noindex = false,
  notFound = false,
  enabled = true,
}) {
  useEffect(() => {
    // Remove the previous route's tags before applying the next metadata surface.
    for (const tag of document.head.querySelectorAll(`[${PAGE_META_MARKER}]`)) {
      tag.remove();
    }
    if (!enabled) return;
    const defaults = readMetadataDefaults();
    const fullTitle = `${title} — ${SITE_NAME}`;
    const image = assetUrl(defaults, defaults.defaultImage);
    document.title = fullTitle;

    setMetaTag('name', 'description', description);
    setMetaTag('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:site_name', SITE_NAME);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
    if (image) {
      setMetaTag('property', 'og:image', image);
      setMetaTag('property', 'og:image:alt', fullTitle);
      setMetaTag('name', 'twitter:image', image);
      setMetaTag('name', 'twitter:image:alt', fullTitle);
    }
    if (notFound) {
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    } else {
      const canonical = canonicalUrl(defaults);
      setCanonical(canonical);
      setMetaTag('property', 'og:url', canonical);
    }
  }, [description, enabled, noindex, notFound, title]);
}

// Resolves the current route against the public site URL and trailing-slash policy.
function canonicalUrl(defaults) {
  const siteUrl = defaults.siteUrl ?? window.location.origin;
  const base = defaults.base && defaults.base !== '/' ? defaults.base.replace(/\/$/, '') : '';
  let pathname = window.location.pathname;
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    pathname = pathname.slice(base.length) || '/';
  }
  if (defaults.trailingSlash === 'always') {
    if (pathname !== '/' && !pathname.endsWith('/')) pathname = `${pathname}/`;
  } else if (defaults.trailingSlash === 'never') {
    pathname = pathname.replace(/\/+$/, '') || '/';
  } else if (defaults.flatOutput !== true) {
    if (pathname !== '/' && !pathname.endsWith('/')) pathname = `${pathname}/`;
  }
  return new URL(`${base}${pathname}`, siteUrl).href;
}

// Resolves a metadata asset against the public site URL and base path.
function assetUrl(defaults, value) {
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return value;
  const siteUrl = defaults.siteUrl ?? window.location.origin;
  const base = defaults.base && defaults.base !== '/' ? defaults.base.replace(/\/$/, '') : '';
  return new URL(`${base}${value.startsWith('/') ? value : `/${value}`}`, siteUrl).href;
}

// Creates or updates the canonical link so crawlers see one public URL per route.
function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute(PAGE_META_MARKER, '');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}
