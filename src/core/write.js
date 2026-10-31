import { createHash } from 'node:crypto';
import { parse, serialize } from 'parse5';
import { findBuildOriginUrls } from './build-origin.js';
import { applyCspHashesToDocument } from './csp.js';
import { resolveHydrationPolicy } from './hydration-policy.js';
import { inlineCriticalCss } from './inline-css.js';
import { applyLocaleMetadata, buildLocaleLinks, localePageUrl } from './locales.js';
import { minifyHtml } from './minify.js';
import { normaliseHtml } from './normalize.js';
import {
  findOutputCollisions,
  routeToFile,
  routeToScreenshotFile,
  writeBufferIfChanged,
  writeFileIfChanged,
  writeRouteHtml,
} from './output.js';
import { collectPageMetaFromDocument } from './page-meta.js';
import { collectScriptSourcesFromDocument, injectPreloadLinksInto } from './preload-links.js';
import { collectPageResourcesFromDocument } from './preload-manifest.js';
import { resolveRouteConfig } from './route-config.js';
import { normaliseRoute, toPublicPath } from './routes.js';
import { mapLimit } from './scheduler.js';
import {
  buildSeoLocaleScript,
  injectSeoLocaleScript,
  resolveSeoLocale,
  seoLocaleMetadataOptions,
} from './seo-locale.js';

const WRITE_CONCURRENCY = 4;

/**
 * Writes every rendered route and returns the routes that can be verified. A write
 * failure is recorded against its route instead of aborting the remaining writes.
 */
export async function writeAllRoutes({
  rendered,
  routeLocales = new Map(),
  localePlan = null,
  outputDir,
  config,
  log,
  report,
  state,
  manifestEntries,
  caches = null,
}) {
  const sorted = [...report.routes].sort();
  const conflicted = reportOutputCollisions({ routes: sorted, config, log, report });

  await writeStateScripts({ rendered, outputDir, config, log, report });

  const verifiable = [];
  const hashes = new Map();
  const localeScripts = new Map();
  const { results } = await mapLimit(
    sorted,
    Math.min(WRITE_CONCURRENCY, config.concurrency),
    async (route) => {
      if (conflicted.has(route)) return null;
      const routeReport = { errors: [], duplicateTitles: [], cspSkipped: [], files: [] };
      try {
        const routeConfig = resolveRouteConfig(config, route);
        const result = rendered.get(route);
        const { file, resources } = await writeRouteOutput({
          route,
          result,
          outputDir,
          config: routeConfig,
          log,
          state,
          report: routeReport,
          caches,
          locale: routeLocales.get(route)?.locale ?? null,
          baseRoute: routeLocales.get(route)?.baseRoute ?? route,
          localePlan,
          localeScripts,
        });
        return {
          route,
          result,
          file,
          resources,
          hash: file.hash,
          report: routeReport,
        };
      } catch (error) {
        routeReport.errors.push({ route, message: `write failed: ${error.message}` });
        log.error(`  write failed for ${route}: ${error.message}`);
        return { route, report: routeReport };
      }
    },
  );

  for (const entry of results) {
    if (!entry) continue;
    for (const error of entry.report.errors) report.errors.push(error);
    for (const route of entry.report.duplicateTitles) report.duplicateTitles.push(route);
    for (const route of entry.report.cspSkipped) report.cspSkipped.push(route);
    for (const file of entry.report.files ?? []) report.files.push(file);
    if (!entry.file) continue;
    const { route, result, file, resources } = entry;
    report.files.push(file);
    report.routeDetails.push({
      route,
      locale: routeLocales.get(route)?.locale?.code ?? null,
      order: result.order ?? null,
      file: file.file,
      status: file.status,
      bytes: file.bytes,
      depth: result.depth ?? null,
      attempts: result.attempts ?? 1,
      httpStatus: result.httpStatus ?? null,
      finalUrl: result.finalUrl ?? null,
      empty: result.empty === true,
      notFound: file.notFound === true,
      noindex: file.noindex === true,
      meta: file.meta ?? null,
      images: file.images ?? [],
      alternates: file.alternates ?? [],
      localeUrl: file.localeUrl ?? null,
      mode: null,
      framework: null,
      hydrationErrors: [],
      ignoredHydrationErrors: [],
      hydrationPolicy: resolveHydrationPolicy(config, route),
      hydrationAllowed: false,
      pageErrors: result.pageErrors ?? [],
      consoleErrors: result.consoleErrors ?? [],
      failedRequests: result.failedRequests ?? [],
      firstMismatch: null,
      buildOriginUrls: file.buildOriginUrls ?? [],
    });
    if (resources) manifestEntries.push({ route, ...resources });
    if (entry.hash) {
      const group = hashes.get(entry.hash) ?? [];
      group.push(route);
      hashes.set(entry.hash, group);
    }
    verifiable.push(route);
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
async function writeRouteOutput({
  route,
  result,
  outputDir,
  config,
  log,
  state,
  report,
  caches,
  locale = null,
  baseRoute = route,
  localePlan = null,
  localeScripts = new Map(),
}) {
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

  const needsString =
    config.inlineCss === 'critical' || Boolean(config.minifyHtml) || Boolean(config.transformHtml);
  const normalised = normaliseHtml(
    result.html,
    {
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
    },
    { serialize: needsString },
  );
  const { stats } = normalised;
  let document = normalised.document;
  let preTransformScripts = new Set();
  let transformedHtml = null;
  let localeChanged = false;
  if (needsString) {
    let output = normalised.html;
    if (config.inlineCss === 'critical') {
      output = await applyCriticalCss({ output, outputDir, config, log, state, caches });
    }
    if (config.minifyHtml) {
      output = await minifyHtml(output, config.minifyHtml, config.minifyCss);
    }
    if (config.transformHtml) {
      preTransformScripts = collectScriptSourcesFromDocument(document);
      const transformed = await config.transformHtml(output, {
        route,
        file: routeToFile(route, config),
        stats,
        config,
      });
      if (transformed !== null && transformed !== undefined && typeof transformed !== 'string') {
        throw new TypeError('transformHtml must return a string, null or undefined');
      }
      output = transformed ?? output;
    }
    transformedHtml = output;
    document = parse(output);
  }
  const noindex =
    documentHasNoindex(document) ||
    (config.notFoundRoute !== null &&
      normaliseRoute(baseRoute) === normaliseRoute(config.notFoundRoute));
  const localeLinks =
    locale && localePlan ? buildLocaleLinks({ locale, baseRoute, plan: localePlan, config }) : null;
  if (localeLinks) {
    localeChanged = true;
    const seo = resolveSeoLocale(config, locale, route);
    applyLocaleMetadata(document, localeLinks, {
      skipAlternates: noindex,
      ...seoLocaleMetadataOptions(seo),
    });
    if (seo?.inject) {
      const script = buildSeoLocaleScript(seo);
      const external = config.csp === 'strict' || (config.externalScripts && config.csp !== 'hash');
      if (external) {
        const externalHref = await ensureLocaleScript({
          script,
          outputDir,
          config,
          report,
          log,
          cache: localeScripts,
        });
        if (externalHref) injectSeoLocaleScript(document, script, externalHref);
      } else {
        injectSeoLocaleScript(document, script, null);
      }
    }
  }
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

  let preloadAdded = 0;
  if (config.preloadLinks) {
    const basePrefix = config.base === '/' ? '' : config.base.slice(0, -1);
    const skipScripts = new Set(
      [...preTransformScripts].map((src) => {
        if (!src.startsWith('/')) return src;
        const appRelative =
          basePrefix && (src === basePrefix || src.startsWith(`${basePrefix}/`))
            ? src.slice(basePrefix.length)
            : src;
        return toPublicPath(appRelative, config.base);
      }),
    );
    preloadAdded = injectPreloadLinksInto(document, {
      scripts: config.removeScriptTags ? [] : [...result.collector.scripts].sort(),
      fonts: new Map(
        [...result.collector.fonts].sort(([left], [right]) => left.localeCompare(right)),
      ),
      lcpImage: result.lcpImage,
      base: config.base,
      ignoreForPreload: config.ignoreForPreload,
      skipScripts,
    });
  }
  let cspChanged = false;
  if (config.csp === 'hash') {
    const policy = applyCspHashesToDocument(document);
    cspChanged = !policy.existingPolicy;
    if (policy.existingPolicy) {
      log.warn(`  ${route}: kept the existing CSP meta and injected no hashes`);
      report.cspSkipped.push(route);
    } else {
      log.debug(
        `  csp ${route}: hashed ${policy.hashedScripts} script(s) and ${policy.hashedStyles} style(s)`,
      );
    }
  }
  const meta = collectPageMetaFromDocument(document);
  let output =
    transformedHtml !== null && preloadAdded === 0 && !cspChanged && !localeChanged
      ? transformedHtml
      : serialize(document);
  if (localeChanged && config.minifyHtml) {
    output = await minifyHtml(output, config.minifyHtml, config.minifyCss);
  }
  warnOnBuildOriginMetadata({
    origins: stats.metadataOrigins,
    removed: stats.removedMetadata,
    route,
    log,
    state,
  });
  if (meta.titleCount > 1) report.duplicateTitles.push(route);
  const buildOrigins = findBuildOriginUrls(output);
  if (config.failOnBuildOriginMetadata) {
    if (buildOrigins.length > 0) {
      const message = `metadata still points at the build server: ${buildOrigins.join(', ')}`;
      report.errors.push({ route, message });
      log.error(`  ${route}: ${message}`);
    }
  }
  const file = await writeRouteHtml({ dir: outputDir, route, html: output, config });
  const resources = config.preloadManifest
    ? collectPageResourcesFromDocument(document, { base: config.base, route })
    : null;
  return {
    file: {
      ...file,
      // Hash the captured DOM before post-processing adds route-specific extras such as
      // the not-found noindex, so a dead link serving the 404 page is still detected.
      hash: createHash('sha256')
        .update(result.html ?? output)
        .digest('hex'),
      noindex: meta.noindex,
      notFound: result.notFound === true,
      meta,
      images: meta.images,
      alternates: meta.alternates,
      localeUrl: locale
        ? localePageUrl(locale, baseRoute, config, localePlan?.mode ?? 'path')
        : null,
      inlineStyleAttributes: meta.inlineStyleAttributes,
      buildOriginUrls: buildOrigins,
    },
    resources,
  };
}

/**
 * Inlines critical CSS, or explains once why it cannot: the strategy reads stylesheets from
 * the output directory, which a command server does not have to serve.
 */
async function applyCriticalCss({ output, outputDir, config, log, state, caches }) {
  if (!config.serveCmd) {
    return inlineCriticalCss({
      html: output,
      outputDir,
      base: config.base,
      preload: config.criticalCssPreload,
      cache: caches?.criticalCss ?? null,
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
 * Reports whether the document already declares a noindex policy. Locale alternates are
 * skipped on those pages, while language attributes are still applied.
 * @param {object} document
 * @returns {boolean}
 */
function documentHasNoindex(document) {
  let noindex = false;
  const walk = (node) => {
    if (noindex) return;
    if (
      node.tagName === 'meta' &&
      node.attrs?.some((entry) => entry.name === 'name' && entry.value.toLowerCase() === 'robots')
    ) {
      const content = node.attrs.find((entry) => entry.name === 'content')?.value ?? '';
      if (/\b(noindex|none)\b/i.test(content)) noindex = true;
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
  return noindex;
}

/**
 * Writes the external SEO locale bootstrap once per unique script. The file is
 * content-addressed, so reruns and locales that produce the same script share it.
 * @returns {Promise<string | null>} public href, or null when the write failed
 */
async function ensureLocaleScript({ script, outputDir, config, report, log, cache }) {
  const hash = createHash('sha256').update(script).digest('hex').slice(0, 16);
  const file = `snappy-seo-locale-${hash}.js`;
  if (cache.has(file)) return cache.get(file);
  const pending = (async () => {
    const bytes = Buffer.byteLength(script);
    if (config.dryRun) {
      report.files.push({ route: null, file, status: 'dry-run', bytes });
      return toPublicPath(`/${file}`, config.base);
    }
    try {
      const written = await writeFileIfChanged({ dir: outputDir, file, contents: script });
      report.files.push({ route: null, ...written });
      log.debug(`  wrote ${file}: ${written.status}`);
      return toPublicPath(`/${file}`, config.base);
    } catch (error) {
      report.errors.push({ route: null, message: `locale script write failed: ${error.message}` });
      log.error(`  write failed for ${file}: ${error.message}`);
      return null;
    }
  })();
  cache.set(file, pending);
  return pending;
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
