import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.js';
import { resolveConfig } from './config.js';
import { prepareDestination } from './destination.js';
import { inlineCriticalCss } from './inline-css.js';
import { createLogger } from './log.js';
import { minifyHtml } from './minify.js';
import { normaliseHtml } from './normalize.js';
import { findOutputCollisions, routeToScreenshotFile, writeRouteHtml } from './output.js';
import { buildPreloadManifest } from './preload-manifest.js';
import { renderRoute } from './render.js';
import { crawlRoots, filterRoutes, toPublicPath, withinDepth } from './routes.js';
import { createPool } from './scheduler.js';
import { startCommandServer, startStaticServer } from './server.js';
import { verifyRoutes } from './verify.js';

/**
 * Entry point of the prerenderer: serves the built output, crawls and renders
 * routes in a real browser, post-processes and writes one file per route, then
 * verifies hydration. Returns a report instead of throwing so callers decide how to
 * fail.
 */
export async function prerender(userOptions = {}, { log: injectedLog } = {}) {
  const config = resolveConfig(userOptions);
  const log = injectedLog ?? createLogger(config.logLevel);
  const sourceDir = path.resolve(config.sourceDir);
  const startedAt = Date.now();

  await assertSourceDir(sourceDir, config);
  const outputDir = await resolveOutputDir({ sourceDir, config, log });

  if (config.saveAs !== 'html' && config.verify) {
    log.warn(`saveAs: '${config.saveAs}' writes images, so hydration verification is skipped`);
  }

  const server = config.serveCmd
    ? await startCommandServer({
        command: config.serveCmd,
        url: config.url,
        timeout: config.serveCmdTimeout,
        shutdownTimeout: config.shutdownTimeout,
      })
    : await startStaticServer({ dir: outputDir, base: config.base });

  const report = {
    routes: [],
    files: [],
    errors: [],
    pageErrors: [],
    verification: null,
    preloadManifest: null,
    truncated: null,
    ok: false,
    durationMs: 0,
  };
  const manifestEntries = [];
  let browser = null;

  try {
    const launched = await launchBrowser(config, log);
    browser = launched.browser;
    log.info(`Browser: ${launched.source}`);

    const rendered = await renderAllRoutes({
      browser,
      server,
      config,
      log,
      report,
      manifestEntries,
      outputDir,
    });
    log.info(`Rendered ${report.routes.length} route(s)`);

    const verifiable = await writeAllRoutes({ rendered, outputDir, config, log, report });
    logFileSummary(report, log);

    if (report.truncated) {
      log.error(
        `maxRoutes (${report.truncated.limit}) reached after ${report.truncated.routes} route(s); output is incomplete`,
      );
    }

    if (config.preloadManifest && !config.dryRun) {
      report.preloadManifest = await writePreloadManifest({
        manifestEntries,
        outputDir,
        config,
        log,
      });
    }

    const canVerify = config.verify && !config.dryRun && config.saveAs === 'html';
    if (canVerify && verifiable.length > 0) {
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
    !(config.failOnError && (report.errors.length > 0 || report.truncated !== null)) &&
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
 * Resolves where generated files go. A destination is copied from the source first
 * so assets sit beside the generated HTML; with serveCmd there is nothing to serve
 * from disk, so the destination is only used as the write target.
 */
async function resolveOutputDir({ sourceDir, config, log }) {
  if (config.serveCmd) return path.resolve(config.destination ?? config.sourceDir);
  return prepareDestination({
    sourceDir,
    destination: config.destination ? path.resolve(config.destination) : null,
    log,
  });
}

/**
 * Runs the crawl and render pool. Each rendered page contributes its output, any new
 * same-origin routes, and the resources recorded for the link-hint features.
 */
async function renderAllRoutes({
  browser,
  server,
  config,
  log,
  report,
  manifestEntries,
  outputDir,
}) {
  const visited = new Set();
  const scheduled = new Set();
  const rendered = new Map();
  const cap = config.maxRoutes ?? Number.POSITIVE_INFINITY;

  // Queues routes up to maxRoutes, flagging the report the first time the cap bites.
  const accept = (routes) => {
    const accepted = [];
    for (const route of routes) {
      if (scheduled.has(route)) continue;
      if (scheduled.size >= cap) {
        report.truncated = { limit: config.maxRoutes, routes: scheduled.size };
        break;
      }
      scheduled.add(route);
      accepted.push(route);
    }
    return accepted;
  };

  const pool = createPool({
    concurrency: config.concurrency,
    handler: async ({ route, depth }) => {
      if (visited.has(route)) return;
      visited.add(route);
      log.debug(`rendering ${route}`);
      try {
        const screenshotPath =
          config.saveAs !== 'html' && !config.dryRun
            ? path.join(outputDir, routeToScreenshotFile(route, config))
            : null;
        const result = await renderRoute({
          browser,
          origin: server.origin,
          route,
          config,
          screenshotPath,
        });
        rendered.set(route, result);
        report.routes.push(route);
        manifestEntries.push({
          route,
          scripts: [...result.collector.scripts],
          styles: [...result.collector.styles],
        });
        for (const message of result.pageErrors) {
          report.pageErrors.push({ route, message });
          log.warn(`  page error on ${route}: ${message}`);
        }
        if (config.crawl && withinDepth(depth + 1, config.maxDepth)) {
          const discovered = filterRoutes(result.links, {
            include: config.includeProvided ? config.include : [],
            exclude: config.exclude,
          }).filter((candidate) => !scheduled.has(candidate));
          pool.push(
            accept(discovered).map((candidate) => ({ route: candidate, depth: depth + 1 })),
          );
        }
      } catch (error) {
        report.errors.push({ route, message: error.message });
        log.error(`  failed ${route}: ${error.message}`);
      }
    },
  });

  const roots = accept(crawlRoots(config));
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
async function writeAllRoutes({ rendered, outputDir, config, log, report }) {
  const sorted = [...report.routes].sort();
  const conflicted = reportOutputCollisions({ routes: sorted, config, log, report });

  const verifiable = [];
  for (const route of sorted) {
    if (conflicted.has(route)) continue;
    try {
      const file = await writeRouteOutput({
        route,
        result: rendered.get(route),
        outputDir,
        config,
        log,
      });
      report.files.push(file);
      verifiable.push(route);
    } catch (error) {
      report.errors.push({ route, message: `write failed: ${error.message}` });
      log.error(`  write failed for ${route}: ${error.message}`);
    }
  }
  return verifiable;
}

/**
 * Records an error for every route involved in an output file collision and returns
 * the routes to skip, so an ambiguous write can never overwrite another route.
 */
function reportOutputCollisions({ routes, config, log, report }) {
  const conflicted = new Set();
  for (const [file, colliding] of findOutputCollisions(routes, config)) {
    for (const route of colliding) {
      conflicted.add(route);
      const others = colliding.filter((other) => other !== route).join(', ');
      report.errors.push({
        route,
        message: `output file collision: ${file} is also written by ${others}`,
      });
    }
    log.error(`  output file collision on ${file}: ${colliding.join(', ')}`);
  }
  return conflicted;
}

/**
 * Applies the configured post-processing to one rendered route and writes it: DOM
 * cleanups and link hints, critical CSS extraction, then optional minification.
 */
async function writeRouteOutput({ route, result, outputDir, config, log }) {
  if (result.screenshot) {
    const file = routeToScreenshotFile(route, config);
    const stats = await fs.stat(path.join(outputDir, file));
    return { route, file, status: 'written', bytes: stats.size };
  }

  const { html, stats } = normaliseHtml(result.html, {
    removeStyleTags: config.removeStyleTags,
    removeScriptTags: config.removeScriptTags,
    asyncScriptTags: config.asyncScriptTags,
    removeBlobs: config.removeBlobs,
    preconnectOrigins: config.preconnectThirdParty
      ? [...result.collector.thirdPartyOrigins].sort()
      : [],
    preloadImages: config.preloadImages
      ? [...result.collector.images].sort().map((image) => toPublicPath(image, config.base))
      : [],
  });
  if (stats.removedElements > 0 || stats.dedupedStyles > 0 || stats.hints > 0) {
    log.debug(
      `  cleaned ${route}: ${stats.removedElements} element(s) removed, ${stats.dedupedStyles} duplicate style(s), ${stats.hints} hint(s)`,
    );
  }

  let output = html;
  if (config.inlineCss === 'critical') {
    output = await inlineCriticalCss({ html: output, outputDir, base: config.base });
  }
  if (config.minifyHtml) {
    output = await minifyHtml(output, config.minifyHtml, config.minifyCss);
  }
  return writeRouteHtml({ dir: outputDir, route, html: output, config });
}

/**
 * Writes the preload manifest: per route, the scripts and stylesheets it loaded,
 * as Link header values a host can serve for Early Hints or HTTP headers.
 */
async function writePreloadManifest({ manifestEntries, outputDir, config, log }) {
  const manifest = buildPreloadManifest(manifestEntries, {
    ignoreForPreload: config.ignoreForPreload,
  });
  const file = 'preload-manifest.json';
  await fs.writeFile(path.join(outputDir, file), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  log.info(`Wrote preload manifest covering ${manifest.length} route(s)`);
  return { file, routes: manifest.length };
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
