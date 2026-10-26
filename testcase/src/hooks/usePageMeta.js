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
 * Applies the page title and description for the active route. Prerendering captures the result
 * after React commits, so every generated HTML file carries its own metadata.
 * @param {{ title: string, description: string }} metadata
 */
export function usePageMeta({ title, description }) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`;
    document.title = fullTitle;

    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:site_name', SITE_NAME);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('name', 'twitter:card', 'summary');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
  }, [title, description]);
}
