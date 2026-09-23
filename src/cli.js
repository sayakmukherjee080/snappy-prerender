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
      --concurrency <n>       Parallel browser pages (default: derived from CPU count)
      --timeout <ms>          Per-route timeout (default: 30000)
      --wait-for <selector>   Wait for a selector on every route before capture
      --browser <choice>      auto | chrome | msedge | chromium | path (default: auto)
      --no-browser-download   Refuse the Chrome for Testing fallback download
      --storage-state <file>  Playwright storage state for authenticated routes
      --no-verify             Skip the hydration verification pass
      --no-block-third-party  Allow third-party requests during rendering
      --no-freeze-animations  Do not neutralise CSS animations before capture
      --scroll                Scroll through each page to trigger lazy content
      --flat                  Write about.html instead of about/index.html
      --not-found <route>     Route emitted as 404.html (default: /404)
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
      concurrency: { type: 'string' },
      timeout: { type: 'string' },
      'wait-for': { type: 'string' },
      browser: { type: 'string' },
      'no-browser-download': { type: 'boolean' },
      'storage-state': { type: 'string' },
      'no-verify': { type: 'boolean' },
      'no-block-third-party': { type: 'boolean' },
      'no-freeze-animations': { type: 'boolean' },
      scroll: { type: 'boolean' },
      flat: { type: 'boolean' },
      'not-found': { type: 'string' },
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
  if (values.concurrency !== undefined) options.concurrency = Number(values.concurrency);
  if (values.timeout !== undefined) options.timeout = Number(values.timeout);
  if (values['wait-for'] !== undefined) options.waitFor = values['wait-for'];
  if (values.browser !== undefined) options.browser = values.browser;
  if (values['no-browser-download']) options.browserDownload = false;
  if (values['storage-state'] !== undefined) options.storageState = values['storage-state'];
  if (values['no-verify']) options.verify = false;
  if (values['no-block-third-party']) options.blockThirdParty = false;
  if (values['no-freeze-animations']) options.freezeAnimations = false;
  if (values.scroll) options.scrollToBottom = true;
  if (values.flat) options.flatOutput = true;
  if (values['not-found'] !== undefined) options.notFoundRoute = values['not-found'];
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
