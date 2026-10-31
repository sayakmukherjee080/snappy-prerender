import { expectedPageUrl } from './metadata.js';

/**
 * Ensures the sitemap and the indexable pages describe the same set of URLs. A page
 * missing from the sitemap, a loc with no page, or a noindex page listed are all errors.
 */
export function auditSitemap({ pages, config, report, add }) {
  if (!config.sitemap) return;
  const indexable = new Map();
  const noindex = new Map();
  for (const page of pages) {
    const loc = expectedPageUrl(page.route, config, page.locale);
    if (!loc) continue;
    if (page.noindex || page.notFound) {
      noindex.set(loc, page.route);
      continue;
    }
    indexable.set(loc, page.route);
  }
  const locs = new Set(report.sitemap?.locs ?? []);
  for (const [loc, route] of indexable) {
    if (!locs.has(loc)) {
      add('error', 'sitemap-missing-page', `${route} is missing from the sitemap`, { route });
    }
  }
  for (const loc of locs) {
    if (noindex.has(loc)) {
      add('error', 'sitemap-noindex-page', `sitemap lists noindex ${noindex.get(loc)}`, {
        route: noindex.get(loc),
      });
      continue;
    }
    if (!indexable.has(loc)) {
      add('error', 'sitemap-unknown-page', `sitemap lists ${loc} with no indexable page`, {
        to: loc,
      });
    }
  }
}
