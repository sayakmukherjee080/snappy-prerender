#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  CONFIG_FILE,
  detectProjectDefaults,
  PACKAGE_NAME,
  parseRouteList,
  renderConfigFile,
  writeConfigFile,
} from './core/init.js';
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
      --timeout <ms>          Per-route timeout (default: 30000)
      --wait-for <selector>   Wait for a selector on every route before capture
      --browser <choice>      auto | chrome | msedge | chromium | path (default: auto)
      --no-browser-download   Refuse the Chrome for Testing fallback download
      --browser-download-hash <sha256>  Pin the fallback download to a SHA-256 digest
      --storage-state <file>  Playwright storage state for authenticated routes
      --no-verify             Skip the hydration verification pass
      --fail-on-hydration-error  Fail the build when hydration errors are found
      --fail-on-rerender      Fail when a route re-renders instead of hydrating
      --fail-on-page-error    Fail when a page throws while it is being rendered
      --block-third-party     Block third-party requests while rendering
      --no-block-third-party  Allow third-party requests (the default)
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
      --metadata-site-url <url>       Public site URL for canonical and og:url
      --metadata-site-name <name>     Site name used for og:site_name
      --metadata-title-template <t>   Title template, for example '%s | Example'
      --metadata-default-image <url>  Share image for routes without one
      --metadata-trailing-slash <mode>  preserve | always | never
      --inline-css <strategy> inline | critical (critical needs the beasties package)
      --critical-css-preload <mode>  Swap for deferred CSS: none | body | media | swap | swap-high | swap-low | js | js-lazy
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
      --external-scripts      Write injected state scripts as same-origin files, for a strict CSP
      --csp <mode>            off | strict: strict makes the output work under script-src 'self'
      --no-remove-blobs       Keep blob stylesheet links instead of dropping them
      --ignore-https-errors   Ignore TLS errors while rendering
      --browser-args <args>   Extra browser launch arguments, comma separated
      --url <url>             App URL to connect to when using --serve-cmd
      --serve-cmd <command>   Command that starts the app server instead of static serving
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
      'wait-for': { type: 'string' },
      browser: { type: 'string' },
      'no-browser-download': { type: 'boolean' },
      'browser-download-hash': { type: 'string' },
      'storage-state': { type: 'string' },
      'no-verify': { type: 'boolean' },
      'fail-on-hydration-error': { type: 'boolean' },
      'fail-on-rerender': { type: 'boolean' },
      'fail-on-page-error': { type: 'boolean' },
      'no-block-third-party': { type: 'boolean' },
      'block-third-party': { type: 'boolean' },
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
      'metadata-site-url': { type: 'string' },
      'metadata-site-name': { type: 'string' },
      'metadata-title-template': { type: 'string' },
      'metadata-default-image': { type: 'string' },
      'metadata-trailing-slash': { type: 'string' },
      'inline-css': { type: 'string' },
      'critical-css-preload': { type: 'string' },
      csp: { type: 'string' },
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
      'external-scripts': { type: 'boolean' },
      'no-remove-blobs': { type: 'boolean' },
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
    await runInit(parsed);
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
  if (values['wait-for'] !== undefined) options.waitFor = values['wait-for'];
  if (values.browser !== undefined) options.browser = values.browser;
  if (values['no-browser-download']) options.browserDownload = false;
  if (values['browser-download-hash'] !== undefined) {
    options.browserDownloadHash = values['browser-download-hash'];
  }
  if (values['storage-state'] !== undefined) options.storageState = values['storage-state'];
  if (values['no-verify']) options.verify = false;
  if (values['fail-on-hydration-error']) options.failOnHydrationError = true;
  if (values['fail-on-rerender']) options.failOnRerender = true;
  if (values['fail-on-page-error']) options.failOnPageError = true;
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
  if (values.destination !== undefined) options.destination = values.destination;
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
  if (values['preload-images']) options.preloadImages = true;
  if (values['preload-manifest']) options.preloadManifest = true;
  if (values['ignore-for-preload'] !== undefined) {
    options.ignoreForPreload = splitList(values['ignore-for-preload']);
  }
  if (values['cache-ajax-requests']) options.cacheAjaxRequests = true;
  if (values['remove-scripts']) options.removeScriptTags = true;
  if (values['remove-styles']) options.removeStyleTags = true;
  if (values['async-scripts']) options.asyncScriptTags = true;
  if (values['external-scripts']) options.externalScripts = true;
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
 * Setup wizard: asks for the handful of values that decide what gets prerendered and what the
 * metadata says, then writes snappy.config.js. Flags cover every question, so
 * `snappy-prerender init --yes --metadata-site-url https://example.com` works without a
 * terminal.
 */
async function runInit({ values }) {
  const log = createLogger(values['log-level'] ?? 'info');
  const cwd = process.cwd();
  if (!values.force && fs.existsSync(CONFIG_FILE)) {
    throw new Error(`${CONFIG_FILE} already exists; pass --force to replace it`);
  }
  if (!values.yes && !process.stdin.isTTY) {
    throw new Error('init needs an interactive terminal; pass --yes to accept the defaults');
  }

  const detected = await detectProjectDefaults(cwd);
  const flags = cliOptions({ values, positionals: [] });
  const defaults = defaultsFromFlags(detected, flags);
  const answers = values.yes ? defaults : await askAnswers(defaults, log);
  const cleaned = validatedAnswers(answers, log);

  await writeConfigFile({
    dir: cwd,
    contents: renderConfigFile(cleaned),
    force: values.force === true,
  });
  log.success(`Wrote ${CONFIG_FILE}`);
  printNextSteps({ detected, log });
}

// Turns the flags the CLI already understands into the wizard's starting answers.
function defaultsFromFlags(detected, flags) {
  return {
    sourceDir: flags.sourceDir ?? detected.sourceDir,
    base: flags.base ?? '/',
    include: flags.include ?? ['/'],
    crawl: flags.crawl ?? true,
    siteUrl: flags.metadata?.siteUrl ?? '',
    siteName: flags.metadata?.siteName ?? '',
    titleTemplate: flags.metadata?.titleTemplate ?? '',
    defaultImage: flags.metadata?.defaultImage ?? '',
    trailingSlash: flags.metadata?.trailingSlash ?? '',
    csp: flags.csp ?? 'off',
    externalScripts: flags.externalScripts,
    criticalCssPreload: flags.criticalCssPreload,
  };
}

// Asks every question in order, closing the terminal interface whatever the outcome.
async function askAnswers(defaults, log) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    log.info('A few questions, then a config file with only the options you set.');
    return {
      sourceDir: await ask(rl, 'Build output directory', defaults.sourceDir),
      base: await ask(rl, 'Public base path', defaults.base),
      include: parseRouteList(
        await ask(rl, 'Routes to prerender, comma separated', defaults.include.join(',')),
      ),
      crawl: await askYesNo(rl, 'Follow same-origin links while rendering?', defaults.crawl),
      siteUrl: await ask(
        rl,
        'Public site URL for canonical and og:url, blank to skip',
        defaults.siteUrl,
      ),
      siteName: await ask(rl, 'Site name, blank to skip', defaults.siteName),
      titleTemplate: await ask(
        rl,
        "Title template such as '%s | Example', blank to skip",
        defaults.titleTemplate,
      ),
      csp: (await askYesNo(
        rl,
        "Serve a strict CSP (script-src 'self', no inline scripts)?",
        defaults.csp === 'strict',
      ))
        ? 'strict'
        : 'off',
      defaultImage: defaults.defaultImage,
      trailingSlash: defaults.trailingSlash,
    };
  } finally {
    rl.close();
  }
}

// Asks one question, showing the value Enter will accept.
async function ask(rl, question, fallback) {
  const answer = (await rl.question(`${question} (${fallback}): `)).trim();
  return answer.length > 0 ? answer : fallback;
}

// Asks a yes/no question, treating Enter as the default.
async function askYesNo(rl, question, fallback) {
  const answer = (await rl.question(`${question} (${fallback ? 'Y/n' : 'y/N'}): `))
    .trim()
    .toLowerCase();
  if (answer.length === 0) return fallback;
  return answer === 'y' || answer === 'yes';
}

// Drops values that would make a broken config, so a typo becomes a warning instead.
function validatedAnswers(answers, log) {
  const cleaned = { ...answers };
  if (cleaned.siteUrl && !/^https?:\/\//.test(cleaned.siteUrl)) {
    log.warn(`ignoring site URL ${cleaned.siteUrl}: it must start with http:// or https://`);
    cleaned.siteUrl = '';
  }
  if (cleaned.titleTemplate && !cleaned.titleTemplate.includes('%s')) {
    log.warn('ignoring the title template: it has no %s placeholder');
    cleaned.titleTemplate = '';
  }
  cleaned.include = parseRouteList((cleaned.include ?? ['/']).join(','));
  return cleaned;
}

// Prints what to do next: install if needed, run it, and where the head layer goes.
function printNextSteps({ detected, log }) {
  const run = runnerCommand(detected.runner, PACKAGE_NAME);
  const install = installCommand(detected.runner);
  log.info('');
  log.info('Next steps:');
  if (!detected.installed) log.info(`  Install      ${install}`);
  log.info(`  Dry run      ${run} --dry-run`);
  log.info(`  Prerender    ${run}`);
  log.info('');
  log.info('Per-route titles and meta tags come from the head layer:');
  log.info("  import { Head } from 'snappy-prerender/head';");
  log.info('  <Head title="Awards" description="..." image="/share/awards.png" />');
  if (detected.usesVite) {
    log.info('');
    log.info('Or run it inside the build (vite.config.js):');
    log.info("  import snappy from 'snappy-prerender';");
    log.info('  plugins: [react(), snappy()],');
    log.info(
      `  ${CONFIG_FILE} is read by the snappy-prerender command, so pass the same options to snappy() too.`,
    );
  }
}

// Builds the command that runs a locally installed binary for the project's package runner.
function runnerCommand(runner, binary) {
  if (runner === 'pnpm') return `pnpm exec ${binary}`;
  if (runner === 'yarn') return `yarn ${binary}`;
  return `npx ${binary}`;
}

// Builds the command that installs this package as a dev dependency.
function installCommand(runner) {
  if (runner === 'pnpm') return `pnpm add -D ${PACKAGE_NAME}`;
  if (runner === 'yarn') return `yarn add -D ${PACKAGE_NAME}`;
  return `npm install --save-dev ${PACKAGE_NAME}`;
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
  return Object.keys(metadata).length > 0 ? metadata : null;
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
