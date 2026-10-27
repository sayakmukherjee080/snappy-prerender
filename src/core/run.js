import fs from 'node:fs/promises';
import path from 'node:path';
import { writePreloadManifest, writeSitemap } from './artifacts.js';
import { launchBrowser } from './browser.js';
import { resolveConfig } from './config.js';
import { prepareDestination } from './destination.js';
import { createLogger } from './log.js';
import { routeToFile } from './output.js';
import { pruneStaleFiles, readPruneManifest, writePruneManifest } from './prune.js';
import { renderRoute } from './render.js';
import {
  crawlRoots,
  filterRoutes,
  isIncludedRoute,
  normaliseRoute,
  withinDepth,
} from './routes.js';
import { createPool } from './scheduler.js';
import { startCommandServer, startStaticServer } from './server.js';
import { verifyRoutes } from './verify.js';
import { writeAllRoutes } from './write.js';

/**
 * Entry point of the prerenderer: serves the built output, crawls and renders
 * routes in a real browser, post-processes and writes one file per route, then
 * verifies hydration. Route, page, verification and artifact failures are returned
 * in the report; setup errors such as invalid config, a missing source directory or
 * a browser that cannot start are thrown so the caller can stop immediately.
 */
export async function prerender(userOptions = {}, { log: injectedLog } = {}) {
  const config = resolveConfig(userOptions);
  const log = injectedLog ?? createLogger(config.logLevel);
  for (const warning of config.warnings ?? []) log.warn(warning);
  const sourceDir = path.resolve(config.sourceDir);
  const startedAt = Date.now();

  await assertSourceDir(sourceDir, config);
  const outputDir = await resolveOutputDir({ sourceDir, config, log });
  const previousManifest =
    config.pruneStaleRoutes && !config.dryRun ? await readPruneManifest(outputDir) : null;

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
    consoleErrors: [],
    failedRequests: [],
    emptyPages: [],
    duplicateTitles: [],
    duplicatePages: [],
    verification: null,
    preloadManifest: null,
    sitemap: null,
    pruned: [],
    truncated: null,
    ok: false,
    durationMs: 0,
  };
  const manifestEntries = [];
  const state = { warnedBuildOriginMetadata: false, warnedCriticalCssSkipped: false };
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
    });
    if (report.routes.length === 0) {
      report.errors.push({ route: null, message: 'no routes were rendered' });
      log.error('No routes were rendered; check include, exclude and sourceDir');
    }
    const pageErrors = report.pageErrors.length;
    log.info(
      `Rendered ${report.routes.length} route(s)${pageErrors > 0 ? `, ${pageErrors} page error(s)` : ''}`,
    );
    if (pageErrors > 0 && !config.failOnPageError) {
      log.warn(
        'Page errors are reported, not enforced, so the generated HTML still shipped. Set failOnPageError to fail the build instead.',
      );
    }

    const verifiable = await writeAllRoutes({
      rendered,
      outputDir,
      config,
      log,
      report,
      state,
      manifestEntries,
    });
    logFileSummary(report, log);
    logNotFoundNotice(report, config, log);
    logDuplicateTitles(report, log);

    if (config.sitemap) {
      try {
        await writeSitemap({ outputDir, config, log, report });
      } catch (error) {
        report.errors.push({ route: null, message: `sitemap write failed: ${error.message}` });
        log.error(`sitemap write failed: ${error.message}`);
      }
    }

    if (report.truncated) {
      log.error(
        `maxRoutes (${report.truncated.limit}) reached after ${report.truncated.routes} route(s); output is incomplete`,
      );
    }

    if (config.preloadManifest) {
      try {
        report.preloadManifest = await writePreloadManifest({
          manifestEntries,
          outputDir,
          config,
          log,
          report,
        });
      } catch (error) {
        report.errors.push({
          route: null,
          message: `preload manifest write failed: ${error.message}`,
        });
        log.error(`preload manifest write failed: ${error.message}`);
      }
    }

    const canVerify = config.verify && !config.dryRun && config.saveAs === 'html';
    if (canVerify && config.serveCmd) {
      log.warn(
        'hydration verification is skipped with serveCmd: the command server decides which document it serves, so the written files cannot be checked',
      );
    }
    // With verifyChangedOnly, a route whose HTML file was left untouched is not reloaded: the HTML
    // and the bundle are the same as the last time it was verified.
    const toVerify = config.verifyChangedOnly
      ? verifiable.filter((route) => {
          const file = routeToFile(route, config);
          const entry = report.files.find(
            (candidate) => candidate.route === route && candidate.file === file,
          );
          return entry?.status !== 'unchanged';
        })
      : verifiable;
    const skipped = verifiable.length - toVerify.length;
    if (canVerify && !config.serveCmd && skipped > 0) {
      log.info(`Verification skipped for ${skipped} unchanged route(s), as verifyChangedOnly asks`);
    }
    if (canVerify && !config.serveCmd && toVerify.length > 0) {
      report.verification = await verifyRoutes({
        browser,
        origin: server.origin,
        routes: toVerify.sort(),
        config,
      });
      report.verification.skipped = skipped;
      logVerification(report.verification, config, log);
    }

    if (
      config.pruneStaleRoutes &&
      !config.dryRun &&
      report.errors.length === 0 &&
      report.truncated === null
    ) {
      try {
        report.pruned = await pruneStaleFiles({
          dir: outputDir,
          previous: previousManifest,
          current: report.files.map((file) => file.file).filter(Boolean),
          log,
        });
        await writePruneManifest({
          dir: outputDir,
          files: report.files.map((file) => file.file).filter(Boolean),
        });
        if (report.pruned.length > 0) {
          log.info(`Pruned ${report.pruned.length} stale file(s)`);
        }
      } catch (error) {
        log.warn(`could not prune stale output: ${error.message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
    const stopped = await server.close();
    if (stopped === false) {
      log.warn('serveCmd process did not exit after SIGKILL and may still be running');
    }
  }

  report.durationMs = Date.now() - startedAt;
  const reRendered = report.verification?.modes['re-rendered'] ?? 0;
  const undetected = report.verification
    ? (report.verification.modes.undetected ?? 0) + (report.verification.modes.unknown ?? 0)
    : 0;
  report.ok =
    !(config.failOnError && (report.errors.length > 0 || report.truncated !== null)) &&
    !(config.failOnPageError && report.pageErrors.length > 0) &&
    !(config.failOnEmptyPage && report.emptyPages.length > 0) &&
    !(config.failOnConsoleError && report.consoleErrors.length > 0) &&
    !(config.failOnFailedRequest && report.failedRequests.length > 0) &&
    !(config.failOnDuplicateContent && report.duplicatePages.length > 0) &&
    !(config.failOnHydrationError && report.verification && !report.verification.ok) &&
    !(config.failOnVerificationError && report.verification?.errors.length > 0) &&
    !(config.failOnUndetected && undetected > 0) &&
    !(config.failOnRerender && reRendered > 0);
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
  const hasIndex = await Promise.all(
    ['index.html', 'index.htm'].map((name) =>
      fs
        .stat(path.join(sourceDir, name))
        .then((entry) => entry.isFile())
        .catch(() => false),
    ),
  );
  if (!hasIndex.some(Boolean)) {
    throw new Error(
      `sourceDir has no index.html: ${sourceDir}. Point sourceDir at the built app, not its assets folder.`,
    );
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
async function renderAllRoutes({ browser, server, config, log, report }) {
  const visited = new Set();
  const scheduled = new Set();
  const rendered = new Map();
  const cap = config.maxRoutes ?? Number.POSITIVE_INFINITY;

  // Queues routes up to maxRoutes, flagging the report the first time the cap bites.
  // A seed used only to reach wildcard routes is given output: false and is rendered
  // for its links without being written.
  const accept = (routes, outputFor = () => true) => {
    const accepted = [];
    for (const route of routes) {
      if (scheduled.has(route)) continue;
      if (scheduled.size >= cap) {
        report.truncated = { limit: config.maxRoutes, routes: scheduled.size };
        break;
      }
      scheduled.add(route);
      accepted.push({ route, output: outputFor(route) });
    }
    return accepted;
  };

  const pool = createPool({
    concurrency: config.concurrency,
    handler: async ({ route, depth, output }) => {
      if (visited.has(route)) return;
      visited.add(route);
      log.debug(`rendering ${route}${output ? '' : ' as a crawl seed'}`);
      try {
        const result = await renderRoute({
          browser,
          origin: server.origin,
          route,
          config,
          screenshot: config.saveAs !== 'html',
        });
        if (output && result.empty) {
          report.emptyPages.push(route);
          if (config.failOnEmptyPage) {
            report.errors.push({ route, message: 'rendered an empty page' });
            log.error(`  empty page ${route}: no app content was found`);
            return;
          }
          log.warn(`  empty page ${route}: no app content was found`);
        }
        if (output) {
          rendered.set(route, result);
          report.routes.push(route);
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
        if (config.crawl && withinDepth(depth + 1, config.maxDepth)) {
          const discovered = filterRoutes(result.links, {
            include: config.includeProvided ? config.include : [],
            exclude: config.exclude,
          }).filter((candidate) => !scheduled.has(candidate));
          pool.push(accept(discovered).map((item) => ({ ...item, depth: depth + 1 })));
        }
      } catch (error) {
        report.errors.push({ route, message: error.message });
        log.error(`  failed ${route}: ${error.message}`);
      }
    },
  });

  const roots = accept(
    crawlRoots(config),
    (route) => !config.includeProvided || isIncludedRoute(route, config.include),
  );
  pool.push(roots.map((item) => ({ ...item, depth: 0 })));
  const { errors } = await pool.run();
  for (const { item, error } of errors) {
    report.errors.push({ route: item.route, message: error.message });
    log.error(`  pool error on ${item.route}: ${error.message}`);
  }
  return rendered;
}

// Notes routes whose output carries more than one title, which is what React 19 native
// metadata and the head layer together produce.
function logDuplicateTitles(report, log) {
  if (report.duplicateTitles.length === 0) return;
  const sample = report.duplicateTitles.slice(0, 5).join(', ');
  log.warn(
    `${report.duplicateTitles.length} route(s) contain more than one <title> element: ${sample}${report.duplicateTitles.length > 5 ? ', …' : ''}. React 19 native metadata and the head layer can each write one, so use one system.`,
  );
}

// Notes when a not-found route is configured but was never rendered, so no 404.html
// was written and a static host would serve its own default page instead.
function logNotFoundNotice(report, config, log) {
  if (!config.notFoundRoute || config.dryRun || config.saveAs !== 'html') return;
  const notFoundRoute = normaliseRoute(config.notFoundRoute);
  if (report.routes.includes(notFoundRoute)) return;
  log.warn(
    `no 404.html was written: the notFoundRoute (${notFoundRoute}) was not prerendered. Add it to include, or point notFoundRoute at a route you do prerender.`,
  );
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

// Reports verification results per route, warns when routes discarded their prerendered
// markup, surfaces errors the client logged while booting, and notes when hydration failures
// were reported but not enforced.
function logVerification(verification, config, log) {
  const modes = verification.modes ?? {};
  log.info(
    `Hydration modes: ${modes.hydrated ?? 0} hydrated, ${modes['re-rendered'] ?? 0} re-rendered, ${modes.undetected ?? 0} undetected, ${modes.unknown ?? 0} unknown`,
  );
  const notDetected = (modes.undetected ?? 0) + (modes.unknown ?? 0);
  if (notDetected > 0) {
    log.warn(
      `${notDetected} route(s) could not be classified for hydration. Check that the app mounts into #root, #app or #__next${config.failOnUndetected ? '' : '; set failOnUndetected to fail the build'}.`,
    );
  }
  if (verification.ok) {
    log.success(`Hydration verified for ${verification.routes.length} route(s)`);
  } else {
    const failed = verification.routes.filter((route) => !route.ok);
    for (const entry of failed) {
      log.warn(`Hydration failed on ${entry.route}:`);
      if (entry.status && entry.status >= 400) log.warn(`  HTTP ${entry.status}`);
      if (entry.empty) log.warn('  the page rendered no app content');
      for (const message of entry.hydrationErrors) log.warn(`  ${message.split('\n')[0]}`);
    }
    for (const error of verification.errors) {
      log.warn(`Verification could not run on ${error.route}: ${error.message}`);
    }
    if (failed.length > 0 && !config.failOnHydrationError) {
      log.warn(
        `Hydration failures are reported, not enforced, so the prerendered HTML still shipped. Set failOnHydrationError to fail the build instead.`,
      );
    }
    if (verification.errors.length > 0 && !config.failOnVerificationError) {
      log.warn(
        'Verification could not run on some routes; the prerendered HTML still shipped. Set failOnVerificationError to fail the build instead.',
      );
    }
  }

  for (const entry of verification.routes) {
    for (const message of entry.pageErrors) {
      log.warn(`  page error on ${entry.route} while verifying: ${message.split('\n')[0]}`);
    }
    for (const message of entry.consoleErrors.slice(0, 3)) {
      log.debug(`  console error on ${entry.route}: ${message.split('\n')[0]}`);
    }
  }

  const reRendered = verification.routes.filter((entry) => entry.mode === 're-rendered');
  if (reRendered.length > 0) {
    const sample = reRendered
      .slice(0, 5)
      .map((entry) => entry.route)
      .join(', ');
    log.warn(
      `${reRendered.length} route(s) re-rendered instead of hydrating, so the prerendered markup was discarded on boot: ${sample}${reRendered.length > 5 ? ', …' : ''}`,
    );
  }
}
