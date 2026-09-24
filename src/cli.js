#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createLogger } from './core/log.js';
import { prerender } from './core/run.js';

const HELP = `snappy-prerender — prerender a built SPA into static HTML

Usage:
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
      --timeout <ms>          Per-route timeout (default: 30000)
      --wait-for <selector>   Wait for a selector on every route before capture
      --browser <choice>      auto | chrome | msedge | chromium | path (default: auto)
      --no-browser-download   Refuse the Chrome for Testing fallback download
      --browser-download-hash <sha256>  Pin the fallback download to a SHA-256 digest
      --storage-state <file>  Playwright storage state for authenticated routes
      --no-verify             Skip the hydration verification pass
      --no-block-third-party  Allow third-party requests during rendering
      --allowed-hosts <hosts>  Third-party hosts to allow while blocking the rest, comma separated
      --no-freeze-animations  Do not neutralise CSS animations before capture
      --no-capture-runtime-styles  Do not fold CSSOM-only styles into the output
      --no-capture-form-state  Do not sync checked and selected into the output
      --scroll                Scroll through each page to trigger lazy content
      --flat                  Write about.html instead of about/index.html
      --not-found <route>     Route emitted as 404.html (default: /404)
      --destination <dir>     Write output to another directory (default: in place)
      --save-as <format>      html | png | jpeg (default: html)
      --user-agent <value>    User agent used while rendering (default: SnappyPrerender)
      --inline-css <strategy> inline | critical (critical needs the beasties package)
      --minify-html           Minify the generated HTML
      --minify-css            Minify CSS inlined into the HTML
      --preconnect-third-party  Add preconnect hints for third-party origins (default: on)
      --no-preconnect-third-party  Disable preconnect hints
      --preload-images        Add preload hints for images on the page
      --preload-manifest      Write preload-manifest.json with Link header hints
      --ignore-for-preload <names>  File names excluded from the manifest, comma separated
      --cache-ajax-requests   Expose captured JSON responses as window.snapStore
      --remove-scripts        Strip every script tag from the output
      --remove-styles         Strip every style tag from the output
      --async-scripts         Mark external scripts async
      --no-remove-blobs       Keep blob stylesheet links instead of dropping them
      --ignore-https-errors   Ignore TLS errors while rendering
      --browser-args <args>   Extra browser launch arguments, comma separated
      --url <url>             App URL to connect to when using --serve-cmd
      --serve-cmd <command>   Command that starts the app server instead of static serving
      --dry-run               Render and report without writing files
      --log-level <level>     silent | error | warn | info | debug (default: info)
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
      'wait-for': { type: 'string' },
      browser: { type: 'string' },
      'no-browser-download': { type: 'boolean' },
      'browser-download-hash': { type: 'string' },
      'storage-state': { type: 'string' },
      'no-verify': { type: 'boolean' },
      'no-block-third-party': { type: 'boolean' },
      'allowed-hosts': { type: 'string', multiple: true },
      'no-freeze-animations': { type: 'boolean' },
      'no-capture-runtime-styles': { type: 'boolean' },
      'no-capture-form-state': { type: 'boolean' },
      scroll: { type: 'boolean' },
      flat: { type: 'boolean' },
      'not-found': { type: 'string' },
      destination: { type: 'string' },
      'save-as': { type: 'string' },
      'user-agent': { type: 'string' },
      'inline-css': { type: 'string' },
      'minify-html': { type: 'boolean' },
      'minify-css': { type: 'boolean' },
      'no-preconnect-third-party': { type: 'boolean' },
      'preload-images': { type: 'boolean' },
      'preload-manifest': { type: 'boolean' },
      'ignore-for-preload': { type: 'string', multiple: true },
      'cache-ajax-requests': { type: 'boolean' },
      'remove-scripts': { type: 'boolean' },
      'remove-styles': { type: 'boolean' },
      'async-scripts': { type: 'boolean' },
      'no-remove-blobs': { type: 'boolean' },
      'ignore-https-errors': { type: 'boolean' },
      'browser-args': { type: 'string', multiple: true },
      url: { type: 'string' },
      'serve-cmd': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'log-level': { type: 'string' },
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

  const fileConfig = await loadConfigFile(parsed.values.config);
  const options = { ...fileConfig, ...cliOptions(parsed) };
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
  if (values['wait-for'] !== undefined) options.waitFor = values['wait-for'];
  if (values.browser !== undefined) options.browser = values.browser;
  if (values['no-browser-download']) options.browserDownload = false;
  if (values['browser-download-hash'] !== undefined) {
    options.browserDownloadHash = values['browser-download-hash'];
  }
  if (values['storage-state'] !== undefined) options.storageState = values['storage-state'];
  if (values['no-verify']) options.verify = false;
  if (values['no-block-third-party']) options.blockThirdParty = false;
  if (values['allowed-hosts'] !== undefined)
    options.allowedHosts = splitList(values['allowed-hosts']);
  if (values['no-freeze-animations']) options.freezeAnimations = false;
  if (values['no-capture-runtime-styles']) options.captureRuntimeStyles = false;
  if (values['no-capture-form-state']) options.captureFormState = false;
  if (values.scroll) options.scrollToBottom = true;
  if (values.flat) options.flatOutput = true;
  if (values['not-found'] !== undefined) options.notFoundRoute = values['not-found'];
  if (values.destination !== undefined) options.destination = values.destination;
  if (values['save-as'] !== undefined) options.saveAs = values['save-as'];
  if (values['user-agent'] !== undefined) options.userAgent = values['user-agent'];
  if (values['inline-css'] !== undefined) options.inlineCss = values['inline-css'];
  if (values['minify-html']) options.minifyHtml = true;
  if (values['minify-css']) options.minifyCss = true;
  if (values['no-preconnect-third-party']) options.preconnectThirdParty = false;
  if (values['preload-images']) options.preloadImages = true;
  if (values['preload-manifest']) options.preloadManifest = true;
  if (values['ignore-for-preload'] !== undefined) {
    options.ignoreForPreload = splitList(values['ignore-for-preload']);
  }
  if (values['cache-ajax-requests']) options.cacheAjaxRequests = true;
  if (values['remove-scripts']) options.removeScriptTags = true;
  if (values['remove-styles']) options.removeStyleTags = true;
  if (values['async-scripts']) options.asyncScriptTags = true;
  if (values['no-remove-blobs']) options.removeBlobs = false;
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

/**
 * Loads a JS config file. An explicitly requested file must exist; the implicit
 * snappy.config.js is optional. The default export must be a plain options object.
 */
async function loadConfigFile(explicitPath) {
  if (explicitPath === undefined) {
    if (!fs.existsSync('snappy.config.js')) return {};
    explicitPath = 'snappy.config.js';
  } else if (!fs.existsSync(explicitPath)) {
    throw new Error(`Config file not found: ${explicitPath}`);
  }
  const module = await import(pathToFileURL(explicitPath).href);
  const loaded = module.default ?? {};
  if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
    throw new Error(`Config file must export a plain options object: ${explicitPath}`);
  }
  return loaded;
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
