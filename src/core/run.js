import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.js';
import { resolveConfig } from './config.js';
import { createLogger } from './log.js';
import { normaliseHtml } from './normalize.js';
import { writeRouteHtml } from './output.js';
import { renderRoute } from './render.js';
import { crawlRoots, filterRoutes, withinDepth } from './routes.js';
import { createPool } from './scheduler.js';
import { startCommandServer, startStaticServer } from './server.js';
import { verifyRoutes } from './verify.js';

/**
 * Entry point of the prerenderer: serves the built output, crawls and renders
 * routes in a real browser, writes static HTML per route, then verifies hydration.
 * Returns a report instead of throwing so callers decide how to fail.
 */
export async function prerender(userOptions = {}, { log: injectedLog } = {}) {
  const config = resolveConfig(userOptions);
  const log = injectedLog ?? createLogger(config.logLevel);
  const sourceDir = path.resolve(config.sourceDir);
  const startedAt = Date.now();

  await assertSourceDir(sourceDir, config);

  const server = config.serveCmd
    ? await startCommandServer({
        command: config.serveCmd,
        url: config.url,
        timeout: config.serveCmdTimeout,
        shutdownTimeout: config.shutdownTimeout,
      })
    : await startStaticServer({ dir: sourceDir, base: config.base });

  const report = {
    routes: [],
    files: [],
    errors: [],
    pageErrors: [],
    verification: null,
    ok: false,
    durationMs: 0,
  };
  let browser = null;

  try {
    const launched = await launchBrowser(config, log);
    browser = launched.browser;
    log.info(`Browser: ${launched.source}`);

    const rendered = await renderAllRoutes({ browser, server, config, log, report });
    log.info(`Rendered ${report.routes.length} route(s)`);

    const verifiable = await writeAllRoutes({ rendered, sourceDir, config, log, report });
    logFileSummary(report, log);

    if (config.verify && !config.dryRun && verifiable.length > 0) {
      report.verification = await verifyRoutes({
        browser,
        origin: server.origin,
        routes: verifiable.sort(),
        config,
      });
      logVerification(report.verification, log);
    }
  } finally {
    if (browser) await browser.close();
    const stopped = await server.close();
    if (stopped === false) {
      log.warn('serveCmd process did not exit after SIGKILL and may still be running');
    }
  }

  report.durationMs = Date.now() - startedAt;
  report.ok =
    !(config.failOnError && report.errors.length > 0) &&
    !(config.failOnHydrationError && report.verification && !report.verification.ok);
  return report;
}

/**
 * Fails with a clear message when the output directory is missing, instead of
 * letting every route fail later with an opaque browser navigation error.
 */
async function assertSourceDir(sourceDir, config) {
  if (config.serveCmd) return;
  const stats = await fs.stat(sourceDir).catch(() => null);
  if (!stats?.isDirectory()) {
    throw new Error(`sourceDir does not exist or is not a directory: ${sourceDir}`);
  }
}

/**
 * Runs the crawl and render pool. Each rendered page contributes both its HTML and
 * any new same-origin routes, so discovery and rendering happen in a single pass.
 */
async function renderAllRoutes({ browser, server, config, log, report }) {
  const visited = new Set();
  const rendered = new Map();

  const pool = createPool({
    concurrency: config.concurrency,
    handler: async ({ route, depth }) => {
      if (visited.has(route)) return;
      visited.add(route);
      log.debug(`rendering ${route}`);
      try {
        const result = await renderRoute({ browser, origin: server.origin, route, config });
        const { html, stats } = normaliseHtml(result.html);
        if (stats.removedElements > 0 || stats.dedupedStyles > 0) {
          log.debug(
            `  cleaned ${route}: ${stats.removedElements} element(s) removed, ${stats.dedupedStyles} duplicate style(s)`,
          );
        }
        rendered.set(route, { html });
        report.routes.push(route);
        for (const message of result.pageErrors) {
          report.pageErrors.push({ route, message });
          log.warn(`  page error on ${route}: ${message}`);
        }
        if (config.crawl && withinDepth(depth + 1, config.maxDepth)) {
          const discovered = filterRoutes(result.links, {
            include: config.includeProvided ? config.include : [],
            exclude: config.exclude,
          })
            .filter((candidate) => !visited.has(candidate))
            .map((candidate) => ({ route: candidate, depth: depth + 1 }));
          pool.push(discovered);
        }
      } catch (error) {
        report.errors.push({ route, message: error.message });
        log.error(`  failed ${route}: ${error.message}`);
      }
    },
  });

  const roots = crawlRoots(config);
  pool.push(roots.map((route) => ({ route, depth: 0 })));
  const { errors } = await pool.run();
  for (const { item, error } of errors) {
    report.errors.push({ route: item.route, message: error.message });
    log.error(`  pool error on ${item.route}: ${error.message}`);
  }
  return rendered;
}

/**
 * Writes every rendered route and returns the routes that can be verified. A write
 * failure is recorded against its route instead of aborting the remaining writes.
 */
async function writeAllRoutes({ rendered, sourceDir, config, log, report }) {
  const verifiable = [];
  for (const route of [...report.routes].sort()) {
    const entry = rendered.get(route);
    try {
      const file = await writeRouteHtml({ dir: sourceDir, route, html: entry.html, config });
      report.files.push(file);
      verifiable.push(route);
    } catch (error) {
      report.errors.push({ route, message: `write failed: ${error.message}` });
      log.error(`  write failed for ${route}: ${error.message}`);
    }
  }
  return verifiable;
}

// Prints the write outcome counts, including a dedicated dry-run wording.
function logFileSummary(report, log) {
  const written = report.files.filter((file) => file.status === 'written').length;
  const unchanged = report.files.filter((file) => file.status === 'unchanged').length;
  const dryRun = report.files.filter((file) => file.status === 'dry-run').length;
  const failed = report.errors.length > 0 ? `, ${report.errors.length} failed route(s)` : '';

  if (dryRun > 0 && written === 0 && unchanged === 0) {
    log.info(`Dry run: rendered ${dryRun} file(s), nothing written${failed}`);
    return;
  }
  const parts = [`Wrote ${written} file(s)`];
  if (unchanged > 0) parts.push(`${unchanged} unchanged`);
  log.info(parts.join(', ') + failed);
}

// Reports verification results per route, or the pass summary when clean.
function logVerification(verification, log) {
  if (verification.ok) {
    log.success(`Hydration verified for ${verification.routes.length} route(s)`);
    return;
  }
  for (const entry of verification.routes.filter((route) => !route.ok)) {
    log.error(`Hydration failed on ${entry.route}:`);
    for (const message of entry.hydrationErrors) log.error(`  ${message.split('\n')[0]}`);
  }
  for (const error of verification.errors) {
    log.error(`Verification could not run on ${error.route}: ${error.message}`);
  }
}
