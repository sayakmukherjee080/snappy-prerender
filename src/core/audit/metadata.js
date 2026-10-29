import { toPublicPath } from '../routes.js';
import { pagePath } from '../url-policy.js';

/**
 * Checks the metadata a crawler reads on every written page: titles, descriptions,
 * canonicals, headings, build-origin leakage and duplicate values across routes.
 */
export function auditMetadata({ pages, config, add }) {
  const titles = new Map();
  const descriptions = new Map();
  for (const page of pages) {
    const meta = page.meta ?? {};
    if (!meta.title) {
      add('warning', 'missing-title', `no <title> on ${page.route}`, { route: page.route });
    }
    if (!meta.description) {
      add('warning', 'missing-description', `no meta description on ${page.route}`, {
        route: page.route,
      });
    }
    if (!meta.canonical) {
      add('warning', 'missing-canonical', `no canonical link on ${page.route}`, {
        route: page.route,
      });
    }
    if (meta.titleCount > 1) {
      add('error', 'multiple-titles', `${page.route} contains more than one <title>`, {
        route: page.route,
      });
    }
    if (meta.h1Count !== 1) {
      add('warning', 'heading-count', `${page.route} has ${meta.h1Count} <h1> element(s)`, {
        route: page.route,
      });
    }
    if ((page.buildOriginUrls ?? []).length > 0) {
      add(
        'warning',
        'build-origin-metadata',
        `${page.route} still points at the build server: ${page.buildOriginUrls.join(', ')}`,
        { route: page.route },
      );
    }
    if (meta.title) titles.set(meta.title, [...(titles.get(meta.title) ?? []), page.route]);
    if (meta.description) {
      descriptions.set(meta.description, [
        ...(descriptions.get(meta.description) ?? []),
        page.route,
      ]);
    }
    if (config.metadata?.siteUrl && meta.canonical) {
      const expected = expectedPageUrl(page.route, config);
      if (expected && meta.canonical !== expected) {
        add(
          'warning',
          'canonical-mismatch',
          `${page.route} canonical is ${meta.canonical}, expected ${expected}`,
          { route: page.route },
        );
      }
    }
  }
  for (const [title, routes] of titles) {
    if (routes.length < 2) continue;
    add('error', 'duplicate-title', `routes share the title "${title}": ${routes.join(', ')}`, {
      routes,
    });
  }
  for (const [description, routes] of descriptions) {
    if (routes.length < 2) continue;
    add(
      'warning',
      'duplicate-description',
      `routes share the meta description "${description}": ${routes.join(', ')}`,
      { routes },
    );
  }
}

// Resolves the public URL a page should canonicalise and be listed at.
export function expectedPageUrl(route, config) {
  if (!config.metadata?.siteUrl) return null;
  const path = pagePath(route, {
    flatOutput: config.flatOutput,
    trailingSlash: config.metadata.trailingSlash,
  });
  return `${config.metadata.siteUrl.replace(/\/$/, '')}${toPublicPath(path, config.base)}`;
}
