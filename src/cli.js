#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { runInit } from './cli-init.js';
import { createLogger } from './core/log.js';
import { prerender } from './core/run.js';

const HELP = `snappy-prerender — prerender a built SPA into static HTML

Usage:
  snappy-prerender init       Setup wizard that writes snappy.config.js
  snappy-prerender [sourceDir] [options]

Options:
  -s, --source <dir>          Built output directory (default: dist)
      --base <path>           Public base path of the app (default: /)
      --include <routes>      Routes to prerender, comma separated, repeatable (default: /)
      --exclude <routes>      Routes to skip, comma separated, repeatable
      --no-crawl              Disable link crawling, render only included routes
      --max-depth <n>         Crawl depth limit, 0 renders roots only (default: unlimited)
      --max-routes <n>        Stop after this many routes and fail the run (default: unlimited)
      --concurrency <n>       Parallel browser pages (default: derived from CPU count)
      --timeout <ms>          Per-route navigation/settle timeout (default: 30000)
      --quiet-period <ms>     Network must be idle this long before capture (default: 500)
      --scroll-step-delay <ms>  Delay between scroll steps (default: 100)
      --viewport <WxH>        Browser viewport (default: 1280x720)
      --ready-selector <sel>  Selector awaited when set
      --ready-flag <name>     Window flag awaited when defined (default: __prerenderReady)
      --no-headless           Run the browser visibly
      --wait-for <selector>   Wait for a selector on every route before capture
      --browser <choice>      auto | chrome | msedge | chromium | path (default: auto)
      --no-browser-download   Refuse the Chrome for Testing fallback download
      --browser-download-hash <sha256>  Pin the fallback download to a SHA-256 digest
      --browser-download-version <build>  Pin the Chrome for Testing build id
      --storage-state <file>  Playwright storage state for authenticated routes
      --no-verify             Skip the hydration verification pass
      --verify-changed-only   Skip verification for routes whose HTML did not change
      --fail-on-hydration-error  Fail the build when hydration errors are found
      --fail-on-rerender      Fail when a route re-renders instead of hydrating
      --fail-on-page-error    Fail when a page throws while it is being rendered
      --no-fail-on-error      Report route errors without failing the run
      --fail-on-empty-page    Fail when a route renders no app content (default: on)
      --no-fail-on-empty-page Allow an empty page and report it instead
      --fail-on-console-error Fail when the browser logs a console error while rendering
      --fail-on-failed-request  Fail when a same-origin request fails while rendering
      --fail-on-duplicate-content  Fail when two routes produce identical HTML
      --fail-on-build-origin-metadata  Fail when metadata still points at the prerender server
      --fail-on-undetected    Fail when verification cannot find a framework root
      --fail-on-verification-error  Fail when the verification pass cannot run
      --block-third-party     Block third-party requests while rendering
      --no-block-third-party  Allow third-party requests (the default)
      --allowed-hosts <hosts>  Third-party hosts to allow while blocking the rest, comma separated
      --no-freeze-animations  Do not neutralise CSS animations before capture
      --no-capture-runtime-styles  Do not fold CSSOM-only styles into the output
      --no-capture-form-state  Do not sync checked and selected into the output
      --scroll                Scroll through each page to trigger lazy content
      --flat                  Write about.html instead of about/index.html
      --not-found <route>     Route emitted as 404.html (default: /404)
      --routes-file <file>    Read route seeds from a text/JSON file
      --routes-from-sitemap <path-or-url>  Seed routes from a local or remote sitemap
      --route-priority <patterns>  Patterns ranked first when crawling, comma separated
      --report <file>         Write a machine-readable run report (JSON)
      --audit                 Check the written site for broken links and SEO issues (default: on)
      --no-audit              Skip the site audit
      --fail-on-audit-error   Fail when the audit finds an error
      --audit-ignore-links <patterns>  Link patterns excluded from the audit, comma separated
      --preload-links         Inject module, font and LCP image preload hints into each page
      --image-sitemap         List page images in the sitemap
      --framework <name>      auto | react | vue | svelte | preact (default: auto)
      --retries <n>           Retry a failed render this many times (default: 0)
      --retry-delay <ms>      Wait between render attempts (default: 500)
      --trace-on-error        Write a Playwright trace for the final failed attempt
      --destination <dir>     Write output to another directory (default: in place)
      --clean-destination     Empty the destination before copying the build output
      --save-as <format>      html | png | jpeg (default: html)
      --user-agent <value>    User agent used while rendering (default: SnappyPrerender)
      --metadata-site-url <url>       Public site URL for canonical and og:url
      --metadata-site-name <name>     Site name used for og:site_name
      --metadata-title-template <t>   Title template, for example '%s | Example'
      --metadata-default-image <url>  Share image for routes without one
      --metadata-trailing-slash <mode>  preserve | always | never
      --metadata-base <path>  Base path used for absolute metadata URLs
      --inline-css <strategy> inline | critical (critical needs the beasties package)
      --critical-css-preload <mode>  Swap for deferred CSS: none | body | media | swap | swap-high | swap-low | js | js-lazy
      --minify-html           Minify the generated HTML
      --minify-css            Minify CSS inlined into the HTML
      --preconnect-third-party  Add preconnect hints for third-party origins (default: on)
      --no-preconnect-third-party  Disable preconnect hints
      --preload-images        Add preload hints for images on the page
      --preload-manifest      Write preload-manifest.json with Link header hints
      --sitemap               Write sitemap.xml from the rendered routes (needs metadata.siteUrl)
      --ignore-for-preload <names>  File names excluded from the manifest, comma separated
      --cache-ajax-requests   Expose captured JSON responses as window.snapStore
      --max-cached-bytes <n>  Largest JSON response cached per request (default: 5242880)
      --remove-scripts        Strip every script tag from the output
      --remove-styles         Strip every style tag from the output
      --async-scripts         Mark external scripts async
      --external-scripts      Write injected state scripts as same-origin files, for a strict CSP
      --csp <mode>            off | strict | hash: strict for script-src 'self', hash for inline hashes
      --no-remove-blobs       Keep blob stylesheet links instead of dropping them
      --remove-attributes <names>  Drop these attributes from the output, comma separated
      --no-strip-build-origin-metadata  Keep tags that point at the prerender server
      --prune-stale-routes    Delete pages listed by the previous run's manifest
      --ignore-https-errors   Ignore TLS errors while rendering
      --browser-args <args>   Extra browser launch arguments, comma separated
      --url <url>             App URL to connect to when using --serve-cmd
      --serve-cmd <command>   Command that starts the app server instead of static serving
      --serve-cmd-timeout <ms>  How long to wait for the command server (default: 30000)
      --shutdown-timeout <ms>  Grace period before force-killing the server (default: 5000)
      --dry-run               Render and report without writing files
      --log-level <level>     silent | error | warn | info | debug (default: info)
      --yes, -y               Accept every default, for a shell without a terminal
      --force                 Replace an existing snappy.config.js
  -c, --config <file>         Config file (default: snappy.config.js if present)
  -h, --help                  Show this help
  -v, --version               Show version
`;

/**
 * CLI entry point. Loads an optional config file, lets explicit flags win over it,
 * runs the prerenderer, and exits non-zero when the report marks the run failed.
 */
async function main() {
  const parsed = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      base: { type: 'string' },
      include: { type: 'string', multiple: true },
      exclude: { type: 'string', multiple: true },
      'no-crawl': { type: 'boolean' },
      'max-depth': { type: 'string' },
      'max-routes': { type: 'string' },
      concurrency: { type: 'string' },
      timeout: { type: 'string' },
      'quiet-period': { type: 'string' },
      'scroll-step-delay': { type: 'string' },
      'max-cached-bytes': { type: 'string' },
      'serve-cmd-timeout': { type: 'string' },
      'shutdown-timeout': { type: 'string' },
      viewport: { type: 'string' },
      'ready-flag': { type: 'string' },
      'ready-selector': { type: 'string' },
      headless: { type: 'boolean' },
      'wait-for': { type: 'string' },
      browser: { type: 'string' },
      'no-browser-download': { type: 'boolean' },
      'browser-download-hash': { type: 'string' },
      'browser-download-version': { type: 'string' },
      'storage-state': { type: 'string' },
      'no-verify': { type: 'boolean' },
      'verify-changed-only': { type: 'boolean' },
      'fail-on-hydration-error': { type: 'boolean' },
      'fail-on-error': { type: 'boolean' },
      'fail-on-rerender': { type: 'boolean' },
      'fail-on-page-error': { type: 'boolean' },
      'fail-on-empty-page': { type: 'boolean' },
      'fail-on-console-error': { type: 'boolean' },
      'fail-on-failed-request': { type: 'boolean' },
      'fail-on-duplicate-content': { type: 'boolean' },
      'fail-on-build-origin-metadata': { type: 'boolean' },
      'fail-on-undetected': { type: 'boolean' },
      'fail-on-verification-error': { type: 'boolean' },
      'no-block-third-party': { type: 'boolean' },
      'block-third-party': { type: 'boolean' },
      'allowed-hosts': { type: 'string', multiple: true },
      'no-freeze-animations': { type: 'boolean' },
      'no-capture-runtime-styles': { type: 'boolean' },
      'no-capture-form-state': { type: 'boolean' },
      scroll: { type: 'boolean' },
      flat: { type: 'boolean' },
      'not-found': { type: 'string' },
      'routes-file': { type: 'string' },
      'routes-from-sitemap': { type: 'string' },
      'route-priority': { type: 'string', multiple: true },
      report: { type: 'string' },
      audit: { type: 'boolean' },
      'no-audit': { type: 'boolean' },
      'fail-on-audit-error': { type: 'boolean' },
      'audit-ignore-links': { type: 'string', multiple: true },
      'preload-links': { type: 'boolean' },
      'image-sitemap': { type: 'boolean' },
      framework: { type: 'string' },
      retries: { type: 'string' },
      'retry-delay': { type: 'string' },
      'trace-on-error': { type: 'boolean' },
      destination: { type: 'string' },
      'clean-destination': { type: 'boolean' },
      'save-as': { type: 'string' },
      'user-agent': { type: 'string' },
      'metadata-site-url': { type: 'string' },
      'metadata-site-name': { type: 'string' },
      'metadata-title-template': { type: 'string' },
      'metadata-default-image': { type: 'string' },
      'metadata-trailing-slash': { type: 'string' },
      'metadata-base': { type: 'string' },
      'inline-css': { type: 'string' },
      'critical-css-preload': { type: 'string' },
      csp: { type: 'string' },
      'minify-html': { type: 'boolean' },
      'minify-css': { type: 'boolean' },
      'no-preconnect-third-party': { type: 'boolean' },
      'preconnect-third-party': { type: 'boolean' },
      'preload-images': { type: 'boolean' },
      'preload-manifest': { type: 'boolean' },
      sitemap: { type: 'boolean' },
      'ignore-for-preload': { type: 'string', multiple: true },
      'cache-ajax-requests': { type: 'boolean' },
      'remove-scripts': { type: 'boolean' },
      'remove-styles': { type: 'boolean' },
      'async-scripts': { type: 'boolean' },
      'external-scripts': { type: 'boolean' },
      'no-remove-blobs': { type: 'boolean' },
      'remove-attributes': { type: 'string', multiple: true },
      'no-strip-build-origin-metadata': { type: 'boolean' },
      'prune-stale-routes': { type: 'boolean' },
      'ignore-https-errors': { type: 'boolean' },
      'browser-args': { type: 'string', multiple: true },
      url: { type: 'string' },
      'serve-cmd': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'log-level': { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      force: { type: 'boolean' },
      config: { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
  });

  if (parsed.values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.values.version) {
    process.stdout.write(`${readVersion()}\n`);
    return;
  }
  if (parsed.positionals[0] === 'init') {
    await runInit({
      values: parsed.values,
      flags: cliOptions({ values: parsed.values, positionals: [] }),
      log: createLogger(parsed.values['log-level'] ?? 'info'),
      version: readVersion(),
    });
    return;
  }

  const fileConfig = await loadConfigFile(parsed.values.config);
  const cli = cliOptions(parsed);
  const options = { ...fileConfig, ...cli };
  // Metadata flags are partial: they refine a config file value instead of replacing it.
  if (cli.metadata) options.metadata = { ...(fileConfig.metadata ?? {}), ...cli.metadata };
  if (!options.sourceDir) options.sourceDir = 'dist';

  const log = createLogger(options.logLevel ?? 'info');
  const report = await prerender(options, { log });
  if (!report.ok) process.exitCode = 1;
}

/**
 * Translates parsed flags into prerender options, only including flags the user
 * actually passed so config-file values are never clobbered by defaults.
 */
function cliOptions({ values, positionals }) {
  const options = {};
  if (positionals[0] !== undefined) options.sourceDir = positionals[0];
  if (values.source !== undefined) options.sourceDir = values.source;
  if (values.base !== undefined) options.base = values.base;
  if (values.include !== undefined) options.include = splitList(values.include);
  if (values.exclude !== undefined) options.exclude = splitList(values.exclude);
  if (values['no-crawl']) options.crawl = false;
  if (values['max-depth'] !== undefined) options.maxDepth = Number(values['max-depth']);
  if (values['max-routes'] !== undefined) options.maxRoutes = Number(values['max-routes']);
  if (values.concurrency !== undefined) options.concurrency = Number(values.concurrency);
  if (values.timeout !== undefined) options.timeout = Number(values.timeout);
  if (values['quiet-period'] !== undefined) options.quietPeriod = Number(values['quiet-period']);
  if (values['scroll-step-delay'] !== undefined) {
    options.scrollStepDelay = Number(values['scroll-step-delay']);
  }
  if (values['max-cached-bytes'] !== undefined) {
    options.maxCachedBytes = Number(values['max-cached-bytes']);
  }
  if (values['serve-cmd-timeout'] !== undefined) {
    options.serveCmdTimeout = Number(values['serve-cmd-timeout']);
  }
  if (values['shutdown-timeout'] !== undefined) {
    options.shutdownTimeout = Number(values['shutdown-timeout']);
  }
  if (values.viewport !== undefined) {
    const match = /^(\d+)x(\d+)$/i.exec(values.viewport);
    if (!match) throw new Error('viewport must look like 1280x720');
    options.viewport = { width: Number(match[1]), height: Number(match[2]) };
  }
  if (values['ready-selector'] !== undefined) options.readySelector = values['ready-selector'];
  if (values['ready-flag'] !== undefined) options.readyFlag = values['ready-flag'];
  if (values.headless !== undefined) options.headless = values.headless;
  if (values['wait-for'] !== undefined) options.waitFor = values['wait-for'];
  if (values.browser !== undefined) options.browser = values.browser;
  if (values['no-browser-download']) options.browserDownload = false;
  if (values['browser-download-hash'] !== undefined) {
    options.browserDownloadHash = values['browser-download-hash'];
  }
  if (values['browser-download-version'] !== undefined) {
    options.browserDownloadVersion = values['browser-download-version'];
  }
  if (values['storage-state'] !== undefined) options.storageState = values['storage-state'];
  if (values['no-verify']) options.verify = false;
  if (values['verify-changed-only']) options.verifyChangedOnly = true;
  if (values['fail-on-hydration-error']) options.failOnHydrationError = true;
  if (values['fail-on-rerender']) options.failOnRerender = true;
  if (values['fail-on-page-error']) options.failOnPageError = true;
  if (values['fail-on-error'] !== undefined) options.failOnError = values['fail-on-error'];
  if (values['fail-on-empty-page'] !== undefined) {
    options.failOnEmptyPage = values['fail-on-empty-page'];
  }
  if (values['fail-on-console-error']) options.failOnConsoleError = true;
  if (values['fail-on-failed-request']) options.failOnFailedRequest = true;
  if (values['fail-on-duplicate-content']) options.failOnDuplicateContent = true;
  if (values['fail-on-build-origin-metadata']) options.failOnBuildOriginMetadata = true;
  if (values['fail-on-undetected']) options.failOnUndetected = true;
  if (values['fail-on-verification-error']) options.failOnVerificationError = true;
  if (values['no-block-third-party']) options.blockThirdParty = false;
  if (values['block-third-party']) options.blockThirdParty = true;
  if (values['allowed-hosts'] !== undefined)
    options.allowedHosts = splitList(values['allowed-hosts']);
  if (values['no-freeze-animations']) options.freezeAnimations = false;
  if (values['no-capture-runtime-styles']) options.captureRuntimeStyles = false;
  if (values['no-capture-form-state']) options.captureFormState = false;
  if (values.scroll) options.scrollToBottom = true;
  if (values.flat) options.flatOutput = true;
  if (values['not-found'] !== undefined) options.notFoundRoute = values['not-found'];
  if (values['routes-file'] !== undefined) options.routesFile = values['routes-file'];
  if (values['routes-from-sitemap'] !== undefined) {
    options.routesFromSitemap = values['routes-from-sitemap'];
  }
  if (values['route-priority'] !== undefined) {
    options.routePriority = splitList(values['route-priority']);
  }
  if (values.report !== undefined) options.reportPath = values.report;
  if (values.audit !== undefined) options.audit = values.audit;
  else if (values['no-audit']) options.audit = false;
  if (values['fail-on-audit-error']) options.failOnAuditError = true;
  if (values['audit-ignore-links'] !== undefined) {
    options.auditIgnoreLinks = splitList(values['audit-ignore-links']);
  }
  if (values['preload-links']) options.preloadLinks = true;
  if (values['image-sitemap']) options.imageSitemap = true;
  if (values.framework !== undefined) options.framework = values.framework;
  if (values.retries !== undefined) options.retries = Number(values.retries);
  if (values['retry-delay'] !== undefined) options.retryDelay = Number(values['retry-delay']);
  if (values['trace-on-error']) options.traceOnError = true;
  if (values.destination !== undefined) options.destination = values.destination;
  if (values['clean-destination']) options.cleanDestination = true;
  if (values['save-as'] !== undefined) options.saveAs = values['save-as'];
  if (values['user-agent'] !== undefined) options.userAgent = values['user-agent'];
  const metadata = metadataOptions(values);
  if (metadata) options.metadata = metadata;
  if (values['inline-css'] !== undefined) options.inlineCss = values['inline-css'];
  if (values.csp !== undefined) options.csp = values.csp;
  if (values['critical-css-preload'] !== undefined) {
    options.criticalCssPreload =
      values['critical-css-preload'] === 'none' ? false : values['critical-css-preload'];
  }
  if (values['minify-html']) options.minifyHtml = true;
  if (values['minify-css']) options.minifyCss = true;
  if (values['no-preconnect-third-party']) options.preconnectThirdParty = false;
  if (values['preconnect-third-party']) options.preconnectThirdParty = true;
  if (values['preload-images']) options.preloadImages = true;
  if (values['preload-manifest']) options.preloadManifest = true;
  if (values.sitemap) options.sitemap = true;
  if (values['ignore-for-preload'] !== undefined) {
    options.ignoreForPreload = splitList(values['ignore-for-preload']);
  }
  if (values['cache-ajax-requests']) options.cacheAjaxRequests = true;
  if (values['remove-scripts']) options.removeScriptTags = true;
  if (values['remove-styles']) options.removeStyleTags = true;
  if (values['async-scripts']) options.asyncScriptTags = true;
  if (values['external-scripts']) options.externalScripts = true;
  if (values['no-remove-blobs']) options.removeBlobs = false;
  if (values['remove-attributes'] !== undefined) {
    options.removeAttributes = splitList(values['remove-attributes']);
  }
  if (values['no-strip-build-origin-metadata']) options.stripBuildOriginMetadata = false;
  if (values['prune-stale-routes']) options.pruneStaleRoutes = true;
  if (values['ignore-https-errors']) options.ignoreHTTPSErrors = true;
  if (values['browser-args'] !== undefined) options.browserArgs = splitList(values['browser-args']);
  if (values.url !== undefined) options.url = values.url;
  if (values['serve-cmd'] !== undefined) options.serveCmd = values['serve-cmd'];
  if (values['dry-run']) options.dryRun = true;
  if (values['log-level'] !== undefined) options.logLevel = values['log-level'];
  return options;
}

// Splits comma separated flag values and drops empty entries.
function splitList(entries) {
  return entries.flatMap((entry) => entry.split(',')).filter((entry) => entry.length > 0);
}

// Collects the metadata flags, or null when none was passed so a config file value survives.
function metadataOptions(values) {
  const metadata = {};
  if (values['metadata-site-url'] !== undefined) metadata.siteUrl = values['metadata-site-url'];
  if (values['metadata-site-name'] !== undefined) {
    metadata.siteName = values['metadata-site-name'];
  }
  if (values['metadata-title-template'] !== undefined) {
    metadata.titleTemplate = values['metadata-title-template'];
  }
  if (values['metadata-default-image'] !== undefined) {
    metadata.defaultImage = values['metadata-default-image'];
  }
  if (values['metadata-trailing-slash'] !== undefined) {
    metadata.trailingSlash = values['metadata-trailing-slash'];
  }
  if (values['metadata-base'] !== undefined) metadata.base = values['metadata-base'];
  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Loads a JS config file. An explicitly requested file must exist; the implicit
 * snappy.config.js is optional. The default export is either a plain options object or an
 * async function that returns one, which is how routes are computed from a CMS, a sitemap or
 * a file listing without a separate prebuild script.
 */
async function loadConfigFile(explicitPath) {
  if (explicitPath === undefined) {
    if (!fs.existsSync('snappy.config.js')) return {};
    explicitPath = 'snappy.config.js';
  } else if (!fs.existsSync(explicitPath)) {
    throw new Error(`Config file not found: ${explicitPath}`);
  }
  const module = await import(pathToFileURL(explicitPath).href);
  const exported = module.default ?? {};
  let loaded;
  try {
    loaded = typeof exported === 'function' ? await exported() : exported;
  } catch (error) {
    throw new Error(`Config file failed to load: ${error.message}`);
  }
  if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
    throw new Error(
      `Config file must export a plain options object or a function returning one: ${explicitPath}`,
    );
  }
  return resolveSourcePaths(loaded, path.dirname(path.resolve(explicitPath)));
}

// Resolves local route-source paths against the config file, not the process cwd, while
// leaving URLs and absolute paths alone.
function resolveSourcePaths(options, dir) {
  const resolve = (value) => {
    if (typeof value !== 'string' || value.length === 0) return value;
    if (/^https?:\/\//i.test(value) || path.isAbsolute(value)) return value;
    return path.resolve(dir, value);
  };
  return {
    ...options,
    routesFile: resolve(options.routesFile),
    routesFromSitemap: resolve(options.routesFromSitemap),
  };
}

// Reads the package version without importing JSON, keeping Node 20 compatible.
function readVersion() {
  const packageJson = fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  return JSON.parse(packageJson).version;
}

/**
 * Reports whether the user asked for debug logging, which also enables full stack
 * traces on unexpected failures to make OSS bug reports actionable.
 */
function wantsDebugStack() {
  const index = process.argv.indexOf('--log-level');
  return (
    process.argv.includes('--log-level=debug') ||
    (index !== -1 && process.argv[index + 1] === 'debug')
  );
}

main().catch((error) => {
  process.stderr.write(`${wantsDebugStack() ? error.stack : error.message}\n`);
  process.exitCode = 1;
});
