import { useEffect } from 'react';

const SITE_NAME = 'Aether Compute';

/**
 * Creates or updates a single meta tag so each route can own its search and social preview text.
 * @param {'name' | 'property'} attribute
 * @param {string} key
 * @param {string} content
 */
function setMetaTag(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
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
    if (!enabled) return;
    const defaults = readMetadataDefaults();
    const fullTitle = `${title} — ${SITE_NAME}`;
    document.title = fullTitle;

    setMetaTag('name', 'description', description);
    setMetaTag('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:site_name', SITE_NAME);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('name', 'twitter:card', 'summary');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
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

// Creates or updates the canonical link so crawlers see one public URL per route.
function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}
