import fs from 'node:fs/promises';
import path from 'node:path';
import {
  activeLocale,
  isLocalePrefixedRoute,
  localeByCode,
  localeRoute,
  stripLocalePrefix,
} from './locales.js';
import { renderRoute } from './render.js';
import { resolveRouteConfig } from './route-config.js';
import {
  crawlRoots,
  filterRoutes,
  isIncludedRoute,
  matchesPattern,
  normaliseRoute,
  withinDepth,
} from './routes.js';
import { createPool, mapLimit } from './scheduler.js';

/**
 * Runs the crawl and render pool. Each rendered page contributes its output, any new
 * same-origin routes, and the resources recorded for the link-hint features.
 */
export async function renderAllRoutes({
  browser,
  server,
  config,
  log,
  report,
  outputDir,
  sourceSeeds = [],
  caches = null,
  localePlan = null,
}) {
  const visited = new Set();
  const scheduled = new Set();
  const rendered = new Map();
  const routeLocales = new Map();
  const cap = config.maxRoutes ?? Number.POSITIVE_INFINITY;
  let nextOrder = 0;
  const defaultLocale = localePlan ? localeByCode(localePlan, localePlan.default) : null;
  const notFoundRoute = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;

  // Expands a base route into every locale variant it publishes. The not-found route is
  // deliberately not localized: a host needs one 404 document.
  const variantsFor = (route) => {
    if (!localePlan) return [{ route, locale: null, baseRoute: route }];
    if (localePlan.mode === 'single') {
      return [{ route, locale: activeLocale(localePlan), baseRoute: route }];
    }
    const baseRoute = defaultLocale ? stripLocalePrefix(route, defaultLocale) : route;
    const isNotFound = notFoundRoute !== null && normaliseRoute(baseRoute) === notFoundRoute;
    const variants = [];
    for (const locale of localePlan.list) {
      if (isNotFound && locale !== defaultLocale) continue;
      const localized = isNotFound
        ? normaliseRoute(config.notFoundRoute)
        : localeRoute(locale, baseRoute);
      variants.push({ route: localized, locale, baseRoute });
    }
    return variants;
  };

  // Queues routes up to maxRoutes, recording exactly which candidates did not fit.
  // A seed used only to reach wildcard routes is given output: false and is rendered
  // for its links without being written.
  const accept = (routes, outputFor = () => true) => {
    const accepted = [];
    const dropped = [];
    for (const route of routes) {
      if (isLocalePrefixedRoute(route, localePlan)) continue;
      for (const variant of variantsFor(route)) {
        if (scheduled.has(variant.route)) continue;
        if (scheduled.size >= cap) {
          dropped.push(variant.route);
          continue;
        }
        scheduled.add(variant.route);
        routeLocales.set(variant.route, variant);
        accepted.push({
          route: variant.route,
          output: outputFor(variant.baseRoute),
          order: nextOrder,
          locale: variant.locale,
          baseRoute: variant.baseRoute,
        });
        nextOrder += 1;
      }
    }
    if (dropped.length > 0) {
      const previous = report.truncated?.droppedRoutes ?? [];
      report.truncated = {
        limit: config.maxRoutes,
        routes: scheduled.size,
        droppedRoutes: [...new Set([...previous, ...dropped])].sort(),
      };
    }
    return accepted;
  };

  const renderOne = async ({
    route,
    output,
    depth = 0,
    order = null,
    locale = null,
    baseRoute = route,
  }) => {
    if (visited.has(route)) return null;
    visited.add(route);
    log.debug(`rendering ${route}${output ? '' : ' as a crawl seed'}`);
    const routeConfig = resolveRouteConfig(config, route);
    const result = await renderWithRetries({
      browser,
      server,
      route,
      routeConfig,
      config,
      log,
      report,
      outputDir,
      screenshot: config.saveAs !== 'html',
      caches,
      locale,
    });
    if (!result) return null;
    result.depth = depth;
    result.order = order;
    try {
      const notFoundRoute = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;
      const isNotFoundRoute = notFoundRoute !== null && normaliseRoute(baseRoute) === notFoundRoute;
      if (result.statusCode === 404 && !isNotFoundRoute) {
        report.errors.push({ route, message: 'returned 404' });
        log.error(`  route ${route} returned 404`);
        return null;
      }
      if (isNotFoundRoute) {
        result.notFound = true;
        if (!report.notFoundRoutes.includes(route)) report.notFoundRoutes.push(route);
        if (result.statusCode !== null && result.statusCode !== 404) {
          log.warn(`  ignored unknown prerender-status-code ${result.statusCode} on ${route}`);
        }
      } else if (result.statusCode !== null) {
        log.warn(`  ignored unknown prerender-status-code ${result.statusCode} on ${route}`);
      }
      if (output && result.empty) {
        report.emptyPages.push(route);
        if (config.failOnEmptyPage) {
          report.errors.push({ route, message: 'rendered an empty page' });
          log.error(`  empty page ${route}: no app content was found`);
          return null;
        }
        log.warn(`  empty page ${route}: no app content was found`);
      }
      if (output) {
        rendered.set(route, result);
        report.routes.push(route);
        for (const to of result.links) report.links.push({ from: route, to });
      }
      for (const message of result.pageErrors) {
        report.pageErrors.push({ route, message });
        log.warn(`  page error on ${route}: ${message}`);
      }
      for (const message of result.consoleErrors) {
        report.consoleErrors.push({ route, message });
      }
      if (result.consoleErrors.length > 0) {
        log.debug(`  console error on ${route}: ${result.consoleErrors[0]}`);
        if (config.failOnConsoleError) {
          report.errors.push({ route, message: `console error: ${result.consoleErrors[0]}` });
        }
      }
      for (const failure of result.failedRequests) {
        report.failedRequests.push({ route, ...failure });
        const detail = failure.status ? `HTTP ${failure.status}` : failure.error;
        log.warn(`  failed request on ${route}: ${failure.url} (${detail})`);
      }
      if (result.failedRequests.length > 0 && config.failOnFailedRequest) {
        const first = result.failedRequests[0];
        report.errors.push({
          route,
          message: `failed request: ${first.url}${first.status ? ` (HTTP ${first.status})` : ''}`,
        });
      }
      return { result, routeConfig };
    } catch (error) {
      report.errors.push({ route, message: error.message });
      log.error(`  failed ${route}: ${error.message}`);
      return null;
    }
  };

  const outputFor = (route) => !config.includeProvided || isIncludedRoute(route, config.include);
  const candidates = [];
  if (sourceSeeds.length > 0) candidates.push(...sourceSeeds);
  if (sourceSeeds.length === 0 || config.includeProvided) {
    candidates.push(...crawlRoots(config));
  }
  const roots = accept(
    [...new Set(sortRoutes(candidates, config))].filter(
      (route) => !isLocalePrefixedRoute(route, localePlan),
    ),
    outputFor,
  );

  const deterministic = config.maxRoutes !== null || config.routePriority.length > 0;
  if (deterministic) {
    await renderWaves({ config, accept, renderOne, roots, report, log });
  } else {
    const pool = createPool({
      concurrency: config.concurrency,
      handler: async ({ route, depth, output, order, locale, baseRoute }) => {
        const renderedRoute = await renderOne({ route, output, depth, order, locale, baseRoute });
        if (!renderedRoute) return;
        const { result, routeConfig } = renderedRoute;
        if (routeConfig.crawl && withinDepth(depth + 1, routeConfig.maxDepth)) {
          const discovered = filterRoutes(result.links, {
            include: config.includeProvided ? config.include : [],
            exclude: config.exclude,
          })
            .filter((candidate) => !isLocalePrefixedRoute(candidate, localePlan))
            .filter((candidate) => !scheduled.has(candidate));
          const accepted = accept(sortRoutes(discovered, config));
          pool.push(accepted.map((item) => ({ ...item, depth: depth + 1 })));
        }
      },
    });
    pool.push(roots.map((item) => ({ ...item, depth: 0 })));
    const { errors } = await pool.run();
    for (const { item, error } of errors) {
      report.errors.push({ route: item.route, message: error.message });
      log.error(`  pool error on ${item.route}: ${error.message}`);
    }
  }
  return { rendered, routeLocales };
}

/**
 * Renders one route with the configured retry policy. A retryable failure is retried
 * after retryDelay; the final failure records the attempt count and, when traceOnError
 * is on, a Playwright trace written under the output directory.
 */
async function renderWithRetries({
  browser,
  server,
  route,
  routeConfig,
  config,
  log,
  report,
  outputDir,
  screenshot,
  caches,
  locale,
}) {
  const attempts = config.retries + 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const traceFile =
      config.traceOnError && !config.dryRun && attempt === attempts
        ? await prepareTraceFile(outputDir, route, attempt)
        : null;
    try {
      const result = await renderRoute({
        browser,
        origin: server.origin,
        route,
        locale,
        config: routeConfig,
        screenshot,
        traceFile,
        caches,
      });
      if (attempt > 1) log.info(`  ${route}: succeeded on attempt ${attempt}`);
      result.attempts = attempt;
      return result;
    } catch (error) {
      if (error.tracePath) {
        report.traces.push({ route, attempt, file: error.tracePath });
        log.warn(`  trace for ${route}: ${error.tracePath}`);
      }
      if (error.retryable !== false && attempt < attempts) {
        log.warn(
          `  attempt ${attempt}/${attempts} failed for ${route}: ${error.message}; retrying`,
        );
        await delay(config.retryDelay);
        continue;
      }
      report.errors.push({ route, message: error.message, attempts: attempt });
      log.error(`  failed ${route} after ${attempt} attempt(s): ${error.message}`);
      return null;
    }
  }
  return null;
}

// Creates the trace directory and returns the archive path for one failed attempt.
async function prepareTraceFile(outputDir, route, attempt) {
  const slug = route
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .toLowerCase();
  const dir = path.join(outputDir, 'snappy-traces');
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${slug || 'root'}-${attempt}.zip`);
}

// Waits between retry attempts.
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deterministic BFS crawl used when maxRoutes or routePriority is set. Each depth level
 * is sorted, capped and rendered as a wave, so the accepted set never depends on which
 * concurrent page happened to finish first.
 */
async function renderWaves({ config, accept, renderOne, roots, report, log }) {
  let frontier = roots.map((item) => ({ ...item, depth: 0 }));
  let depth = 0;
  while (frontier.length > 0) {
    const { results, errors } = await mapLimit(frontier, config.concurrency, async (item) => ({
      item,
      rendered: await renderOne(item),
    }));
    for (const { item, error } of errors) {
      report.errors.push({ route: item.route, message: error.message });
      log.error(`  pool error on ${item.route}: ${error.message}`);
    }
    const discovered = [];
    for (const { rendered: renderedRoute } of results) {
      if (!renderedRoute) continue;
      if (!renderedRoute.routeConfig.crawl) continue;
      if (!withinDepth(depth + 1, config.maxDepth)) continue;
      discovered.push(
        ...filterRoutes(renderedRoute.result.links, {
          include: config.includeProvided ? config.include : [],
          exclude: config.exclude,
        }),
      );
    }
    if (!withinDepth(depth + 1, config.maxDepth)) break;
    const next = accept(sortRoutes(discovered, config));
    frontier = next.map((item) => ({ ...item, depth: depth + 1 }));
    depth += 1;
  }
}

// Orders routes by routePriority first, then by path for a stable frontier.
function sortRoutes(routes, config) {
  return [...routes].sort((a, b) => sortRoute(a, b, config));
}

function sortRoute(a, b, config) {
  const rank = (route) => {
    const index = config.routePriority.findIndex((pattern) => matchesPattern(route, pattern));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const difference = rank(a) - rank(b);
  return difference === 0 ? a.localeCompare(b) : difference;
}
