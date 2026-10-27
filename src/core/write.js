import { createHash } from 'node:crypto';
import { findBuildOriginUrls } from './build-origin.js';
import { inlineCriticalCss } from './inline-css.js';
import { minifyHtml } from './minify.js';
import { normaliseHtml } from './normalize.js';
import {
  findOutputCollisions,
  routeToScreenshotFile,
  writeBufferIfChanged,
  writeFileIfChanged,
  writeRouteHtml,
} from './output.js';
import { collectPageResources } from './preload-manifest.js';
import { normaliseRoute, toPublicPath } from './routes.js';

/**
 * Writes every rendered route and returns the routes that can be verified. A write
 * failure is recorded against its route instead of aborting the remaining writes.
 */
export async function writeAllRoutes({
  rendered,
  outputDir,
  config,
  log,
  report,
  state,
  manifestEntries,
}) {
  const sorted = [...report.routes].sort();
  const conflicted = reportOutputCollisions({ routes: sorted, config, log, report });

  await writeStateScripts({ rendered, outputDir, config, log, report });

  const verifiable = [];
  const hashes = new Map();
  for (const route of sorted) {
    if (conflicted.has(route)) continue;
    try {
      const { file, resources } = await writeRouteOutput({
        route,
        result: rendered.get(route),
        outputDir,
        config,
        log,
        state,
        report,
      });
      report.files.push(file);
      if (resources) manifestEntries.push({ route, ...resources });
      if (file.hash) {
        const group = hashes.get(file.hash) ?? [];
        group.push(route);
        hashes.set(file.hash, group);
      }
      verifiable.push(route);
    } catch (error) {
      report.errors.push({ route, message: `write failed: ${error.message}` });
      log.error(`  write failed for ${route}: ${error.message}`);
    }
  }
  reportDuplicatePages({ groups: [...hashes.values()], config, log, report });
  return verifiable;
}

/**
 * Reports routes that produced byte-identical HTML. The usual cause is an SPA fallback
 * serving the shell for a path the app does not route, which would otherwise publish a
 * copy of another page under a dead URL.
 */
function reportDuplicatePages({ groups, config, log, report }) {
  for (const routes of groups) {
    if (routes.length < 2) continue;
    report.duplicatePages.push({ routes });
    log.warn(
      `identical output for ${routes.join(', ')}: check for a dead link served by the SPA fallback`,
    );
    if (config.failOnDuplicateContent) {
      for (const route of routes) {
        report.errors.push({
          route,
          message: `identical output to ${routes.filter((other) => other !== route).join(', ')}`,
        });
      }
    }
  }
}

/**
 * Writes the captured-state scripts routes reference when externalScripts is on. The payload
 * is content-addressed, so routes that inject the same state share one file and a rerun
 * leaves it untouched.
 */
async function writeStateScripts({ rendered, outputDir, config, log, report }) {
  const seen = new Set();
  for (const [route, result] of rendered) {
    const stateScript = result?.stateScript;
    if (!stateScript || seen.has(stateScript.file)) continue;
    seen.add(stateScript.file);
    if (config.dryRun) {
      report.files.push({
        route,
        file: stateScript.file,
        status: 'dry-run',
        bytes: Buffer.byteLength(stateScript.contents),
      });
      continue;
    }
    try {
      const written = await writeFileIfChanged({
        dir: outputDir,
        file: stateScript.file,
        contents: stateScript.contents,
      });
      report.files.push({ route, ...written });
      log.debug(`  wrote ${stateScript.file}: ${written.status}`);
    } catch (error) {
      report.errors.push({ route, message: `write failed: ${error.message}` });
      log.error(`  write failed for ${stateScript.file}: ${error.message}`);
    }
  }
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
async function writeRouteOutput({ route, result, outputDir, config, log, state, report }) {
  if (result.screenshot) {
    const file = routeToScreenshotFile(route, config);
    if (config.dryRun) {
      return {
        file: {
          route,
          file,
          status: 'dry-run',
          bytes: result.screenshot.length,
        },
        resources: null,
      };
    }
    const written = await writeBufferIfChanged({
      dir: outputDir,
      file,
      buffer: result.screenshot,
    });
    return { file: { route, ...written }, resources: null };
  }

  const { html, stats } = normaliseHtml(result.html, {
    removeStyleTags: config.removeStyleTags,
    removeScriptTags: config.removeScriptTags,
    asyncScriptTags: config.asyncScriptTags,
    removeBlobs: config.removeBlobs,
    removeAttributes: config.removeAttributes,
    stripBuildOriginMetadata: config.stripBuildOriginMetadata,
    noindex:
      config.notFoundRoute !== null &&
      normaliseRoute(route) === normaliseRoute(config.notFoundRoute),
    preconnectOrigins: config.preconnectThirdParty
      ? [...result.collector.thirdPartyOrigins].sort()
      : [],
    preloadImages: config.preloadImages
      ? [...result.collector.images].sort().map((image) => toPublicPath(image, config.base))
      : [],
  });
  if (
    stats.removedElements > 0 ||
    stats.removedAttributes > 0 ||
    stats.dedupedStyles > 0 ||
    stats.hints > 0 ||
    stats.textSeparators > 0
  ) {
    log.debug(
      `  cleaned ${route}: ${stats.removedElements} element(s) removed, ${stats.removedAttributes} attribute(s) removed, ${stats.dedupedStyles} duplicate style(s), ${stats.hints} hint(s), ${stats.textSeparators} text separator(s)`,
    );
  }
  if ((result.inlineCssSkipped ?? []).length > 0) {
    log.debug(`  inline css: left ${result.inlineCssSkipped.length} stylesheet(s) as links`);
  }

  let output = html;
  if (config.inlineCss === 'critical') {
    output = await applyCriticalCss({ output, outputDir, config, log, state });
  }
  if (config.minifyHtml) {
    output = await minifyHtml(output, config.minifyHtml, config.minifyCss);
  }
  warnOnBuildOriginMetadata({
    origins: stats.metadataOrigins,
    removed: stats.removedMetadata,
    route,
    log,
    state,
  });
  if (stats.titleElements > 1) report.duplicateTitles.push(route);
  if (config.failOnBuildOriginMetadata) {
    const origins = findBuildOriginUrls(output);
    if (origins.length > 0) {
      const message = `metadata still points at the build server: ${origins.join(', ')}`;
      report.errors.push({ route, message });
      log.error(`  ${route}: ${message}`);
    }
  }
  const file = await writeRouteHtml({ dir: outputDir, route, html: output, config });
  const resources = config.preloadManifest
    ? collectPageResources(output, { base: config.base, route })
    : null;
  return {
    file: {
      ...file,
      // Hash the captured DOM before post-processing adds route-specific extras such as
      // the not-found noindex, so a dead link serving the 404 page is still detected.
      hash: createHash('sha256')
        .update(result.html ?? output)
        .digest('hex'),
      noindex: stats.noindex,
    },
    resources,
  };
}

/**
 * Inlines critical CSS, or explains once why it cannot: the strategy reads stylesheets from
 * the output directory, which a command server does not have to serve.
 */
async function applyCriticalCss({ output, outputDir, config, log, state }) {
  if (!config.serveCmd) {
    return inlineCriticalCss({
      html: output,
      outputDir,
      base: config.base,
      preload: config.criticalCssPreload,
    });
  }
  if (!state.warnedCriticalCssSkipped) {
    state.warnedCriticalCssSkipped = true;
    log.warn(
      "inlineCss: 'critical' is skipped with serveCmd: stylesheets are read from the output directory, which the command server does not have to serve",
    );
  }
  return output;
}

/**
 * Warns once when metadata contains the build server's origin, which means the page was
 * composed without a public siteUrl and og:url, og:image or canonical would ship wrong.
 */
function warnOnBuildOriginMetadata({ origins, removed = 0, route, log, state }) {
  if (state.warnedBuildOriginMetadata || origins.length === 0) return;
  state.warnedBuildOriginMetadata = true;
  log.warn(
    `metadata on ${route} points at the build server (${origins.join(', ')}); ${
      removed > 0
        ? `removed ${removed} affected tag(s). Set metadata.siteUrl so canonical, og:url and og:image match the deployed site`
        : 'set metadata.siteUrl so og:url, og:image and canonical match the deployed site'
    }`,
  );
}
