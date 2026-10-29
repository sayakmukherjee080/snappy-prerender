import fs from 'node:fs/promises';
import path from 'node:path';
import { routeToFile } from '../output.js';
import { matchesPattern, normaliseRoute } from '../routes.js';
import { mapLimit } from '../scheduler.js';

const LINK_CHECK_CONCURRENCY = 16;

/**
 * Audits every internal link the rendered pages emitted and warns about indexable pages
 * no other page links to.
 */
export async function auditLinks({ report, config, outputDir, add }) {
  const routes = new Set(report.routeDetails.map((detail) => detail.route));
  const files = new Set(report.files.map((file) => file.file).filter(Boolean));
  const cache = new Map();
  const seenPairs = new Set();
  let checkedLinks = 0;
  const pending = [];

  const exists = async (target) => {
    if (cache.has(target)) return cache.get(target);
    const result = await fs
      .stat(path.join(outputDir, target))
      .then((stats) => stats.isFile())
      .catch(() => false);
    cache.set(target, result);
    return result;
  };

  for (const link of report.links) {
    const key = `${link.from}|${link.to}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    if (config.auditIgnoreLinks.some((pattern) => matchesPattern(link.to, pattern))) continue;
    checkedLinks += 1;
    const route = normaliseRoute(link.to);
    if (routes.has(route)) continue;
    const file = routeToFile(route, config);
    if (files.has(file)) continue;
    const asset = route.startsWith('/') ? route.slice(1) : route;
    pending.push({ link, asset });
  }

  const targets = [...new Set(pending.map((entry) => entry.asset).filter(Boolean))];
  const { results } = await mapLimit(targets, LINK_CHECK_CONCURRENCY, exists);
  const existsSet = new Set(targets.filter((_target, index) => results[index] === true));
  for (const { link, asset } of pending) {
    if (asset && existsSet.has(asset)) continue;
    add('error', 'broken-internal-link', `${link.from} links to missing ${link.to}`, {
      from: link.from,
      to: link.to,
      reason: 'missing',
    });
  }
  return { checked: checkedLinks };
}

/**
 * Warns about indexable pages no rendered page links to. A link from a page outside the
 * include list is legitimately absent, so this stays a warning.
 */
export function auditOrphans({ pages, report, add }) {
  const linked = new Set();
  for (const link of report.links) linked.add(normaliseRoute(link.to));
  for (const page of pages) {
    if (page.route === '/' || page.notFound || page.noindex) continue;
    if (!linked.has(page.route)) {
      add('warning', 'orphan-page', `${page.route} is not linked from another page`, {
        route: page.route,
      });
    }
  }
}
