import fs from 'node:fs/promises';
import path from 'node:path';
import { writePreloadManifest, writeSitemap } from './artifacts.js';
import { auditRun } from './audit/index.js';
import { launchBrowser } from './browser.js';
import { resolveConfig } from './config.js';
import { renderAllRoutes } from './crawl.js';
import { prepareDestination } from './destination.js';
import { createLogger } from './log.js';
import { routeToFile } from './output.js';
import { pruneStaleFiles, readPruneManifest, writePruneManifest } from './prune.js';
import { writeReport } from './report.js';
import { loadRouteSeeds } from './route-sources.js';
import { normaliseRoute } from './routes.js';
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
  const [outputDir, routeSources] = await Promise.all([
    resolveOutputDir({ sourceDir, config, log }),
    loadRouteSeeds(config),
  ]);
  const previousManifest =
    config.pruneStaleRoutes && !config.dryRun ? await readPruneManifest(outputDir) : null;
  for (const source of routeSources.sources) {
    const skipped = source.skipped > 0 ? `, ${source.skipped} skipped` : '';
    log.info(`Route source ${source.source}: ${source.routes} route(s)${skipped}`);
  }

  if (config.saveAs !== 'html' && config.verify) {
    log.warn(`saveAs: '${config.saveAs}' writes images, so hydration verification is skipped`);
  }

  const browserPromise = launchBrowser(config, log);
  let server;
  try {
    server = config.serveCmd
      ? await startCommandServer({
          command: config.serveCmd,
          url: config.url,
          timeout: config.serveCmdTimeout,
          shutdownTimeout: config.shutdownTimeout,
        })
      : await startStaticServer({ dir: outputDir, base: config.base });
  } catch (error) {
    browserPromise.then(({ browser }) => browser.close()).catch(() => {});
    throw error;
  }

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
    links: [],
    notFoundRoutes: [],
    routeSources: routeSources.sources,
    routeDetails: [],
    cspSkipped: [],
    traces: [],
    verification: null,
    audit: null,
    preloadManifest: null,
    sitemap: null,
    pruned: [],
    truncated: null,
    ok: false,
    durationMs: 0,
    timings: { render: 0, write: 0, artifacts: 0, verify: 0, audit: 0 },
  };
  const manifestEntries = [];
  const state = { warnedBuildOriginMetadata: false, warnedCriticalCssSkipped: false };
  let browser = null;

  try {
    const launched = await browserPromise;
    browser = launched.browser;
    log.info(`Browser: ${launched.source}`);
    const renderCaches = { inlineCss: new Map(), criticalCss: new Map() };

    let phaseStartedAt = Date.now();
    const rendered = await renderAllRoutes({
      browser,
      server,
      config,
      log,
      report,
      outputDir,
      sourceSeeds: routeSources.routes,
      caches: renderCaches,
    });
    report.timings.render = Date.now() - phaseStartedAt;
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

    phaseStartedAt = Date.now();
    const verifiable = await writeAllRoutes({
      rendered,
      outputDir,
      config,
      log,
      report,
      state,
      manifestEntries,
      caches: renderCaches,
    });
    report.timings.write = Date.now() - phaseStartedAt;
    logFileSummary(report, log);
    logNotFoundNotice(report, config, log);
    logDuplicateTitles(report, log);

    phaseStartedAt = Date.now();
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
    report.timings.artifacts = Date.now() - phaseStartedAt;

    const canVerify = config.verify && !config.dryRun && config.saveAs === 'html';
    if (canVerify && config.serveCmd) {
      log.warn(
        'hydration verification is skipped with serveCmd: the command server decides which document it serves, so the written files cannot be checked',
      );
    }
    // With verifyChangedOnly, a route whose HTML file was left untouched is not reloaded: the HTML
    // and the bundle are the same as the last time it was verified.
    const fileStatus = new Map(
      report.files.map((file) => [`${file.route ?? ''}|${file.file ?? ''}`, file.status]),
    );
    const toVerify = config.verifyChangedOnly
      ? verifiable.filter((route) => {
          const file = routeToFile(route, config);
          return fileStatus.get(`${route}|${file}`) !== 'unchanged';
        })
      : verifiable;
    const skipped = verifiable.length - toVerify.length;
    if (canVerify && !config.serveCmd && skipped > 0) {
      log.info(`Verification skipped for ${skipped} unchanged route(s), as verifyChangedOnly asks`);
    }
    if (canVerify && !config.serveCmd && toVerify.length > 0) {
      phaseStartedAt = Date.now();
      report.verification = await verifyRoutes({
        browser,
        origin: server.origin,
        routes: toVerify.sort(),
        config,
        outputDir,
      });
      report.timings.verify = Date.now() - phaseStartedAt;
      report.verification.skipped = skipped;
      logVerification(report.verification, config, log);
      mergeVerification(report);
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
  if (config.audit) {
    const auditStartedAt = Date.now();
    try {
      report.audit = await auditRun({ report, config, outputDir });
      logAudit(report.audit, log);
    } catch (error) {
      report.errors.push({ route: null, message: `audit failed: ${error.message}` });
      log.error(`audit failed: ${error.message}`);
    }
    report.timings.audit = Date.now() - auditStartedAt;
  }
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
    !(config.failOnAuditError && (report.audit?.errors.length ?? 0) > 0) &&
    !(config.failOnHydrationError && report.verification && !report.verification.ok) &&
    !(config.failOnVerificationError && report.verification?.errors.length > 0) &&
    !(config.failOnUndetected && undetected > 0) &&
    !(config.failOnRerender && reRendered > 0);
  try {
    report.reportFile = await writeReport({ report, config, log });
  } catch (error) {
    report.errors.push({ route: null, message: `report write failed: ${error.message}` });
    log.error(`report write failed: ${error.message}`);
    if (config.failOnError) report.ok = false;
  }
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
    cleanDestination: config.cleanDestination,
  });
}

// Adds the verification result to each route record for the JSON report.
function mergeVerification(report) {
  const details = new Map(report.routeDetails.map((record) => [record.route, record]));
  for (const entry of report.verification?.routes ?? []) {
    const detail = details.get(entry.route);
    if (!detail) continue;
    detail.mode = entry.mode;
    detail.framework = entry.framework ?? null;
    detail.hydrationErrors = entry.hydrationErrors;
    detail.pageErrors = [...new Set([...(detail.pageErrors ?? []), ...entry.pageErrors])];
    detail.consoleErrors = [...new Set([...(detail.consoleErrors ?? []), ...entry.consoleErrors])];
    detail.verificationStatus = entry.status;
    detail.empty = entry.empty || detail.empty;
    detail.firstMismatch = entry.firstMismatch ?? null;
  }
}

// Prints an audit summary and a bounded sample of findings.
function logAudit(audit, log) {
  const errors = audit?.errors?.length ?? 0;
  const warnings = audit?.warnings?.length ?? 0;
  if (errors === 0 && warnings === 0) {
    log.success(`Audit: no issues (${audit?.linksChecked ?? 0} links checked)`);
    return;
  }
  log.info(`Audit: ${errors} error(s), ${warnings} warning(s)`);
  for (const finding of [...(audit?.errors ?? []), ...(audit?.warnings ?? [])].slice(0, 20)) {
    const message = `${finding.rule}: ${finding.message}`;
    if (finding.severity === 'error') log.error(`  ${message}`);
    else log.warn(`  ${message}`);
  }
}

// Notes duplicate title tags, which React 19 native metadata and the head layer can
// each produce.
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
