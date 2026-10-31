#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { runInit } from './cli-init.js';
import { cliOptions } from './cli-options.js';
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
      --freeze-time <iso|build>  Fix Date/Date.now during render and verification
      --timezone <iana>       Browser timezone for render and verification
      --random-seed <n>       Deterministic Math.random for demo content
      --allow-rerender <patterns>  Hydration re-renders allowed for matching routes
      --skip-hydration <patterns>  Skip hydration verification for matching routes
      --locale-mode <mode>    path | single (requires --locales)
      --locales <codes>       Comma-separated locale codes, for example en,fr
      --default-locale <code> Default locale code
      --active-locale <code>  Active locale for single mode
      --locale-prefix <code=prefix>  Locale path prefix, repeatable
      --locale-url <code=url> Locale deployment origin, repeatable
      --locale-storage-state <code=file>  Locale storage state, repeatable
      --no-hreflang           Do not emit hreflang alternates
      --seo-locale <code>     Seed a cookie/localStorage SEO locale
      --seo-locale-source <source>  localStorage | cookie | both
      --seo-locale-key <key>  localStorage key for the SEO locale
      --seo-locale-cookie <name>  Cookie name for the SEO locale
      --no-seo-locale-inject  Do not write the locale bootstrap into output
      --no-seo-locale-verify  Do not seed the verification browser
      --no-seo-locale-render  Do not seed the render browser
      --no-seo-locale-overwrite  Only set the locale when it is missing
      --seo-locale-navigator  Also emulate navigator.language
      --seo-locale-force-html-lang  Override an existing html lang
      --no-verify             Skip the hydration verification pass
      --verify-changed-only   Skip verification for routes whose HTML did not change
      --reuse-verification-context  Reuse one browser context per verification worker
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
      --metadata-default-title <t>    Title used when a page sets no title
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
      'freeze-time': { type: 'string' },
      timezone: { type: 'string' },
      'random-seed': { type: 'string' },
      'allow-rerender': { type: 'string', multiple: true },
      'skip-hydration': { type: 'string', multiple: true },
      'locale-mode': { type: 'string' },
      locales: { type: 'string' },
      'default-locale': { type: 'string' },
      'active-locale': { type: 'string' },
      'locale-prefix': { type: 'string', multiple: true },
      'locale-url': { type: 'string', multiple: true },
      'locale-storage-state': { type: 'string', multiple: true },
      'no-hreflang': { type: 'boolean' },
      'seo-locale': { type: 'string' },
      'seo-locale-source': { type: 'string' },
      'seo-locale-key': { type: 'string' },
      'seo-locale-cookie': { type: 'string' },
      'no-seo-locale-inject': { type: 'boolean' },
      'no-seo-locale-verify': { type: 'boolean' },
      'no-seo-locale-render': { type: 'boolean' },
      'no-seo-locale-overwrite': { type: 'boolean' },
      'seo-locale-navigator': { type: 'boolean' },
      'seo-locale-force-html-lang': { type: 'boolean' },
      'no-verify': { type: 'boolean' },
      'verify-changed-only': { type: 'boolean' },
      'reuse-verification-context': { type: 'boolean' },
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
      'metadata-default-title': { type: 'string' },
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
  if (cli.hydration) {
    options.hydration = { ...(fileConfig.hydration ?? {}), ...cli.hydration };
  }
  if (cli.seoLocale) {
    options.seoLocale = {
      ...(fileConfig.seoLocale ?? {}),
      ...cli.seoLocale,
      cookie: {
        ...(fileConfig.seoLocale?.cookie ?? {}),
        ...(cli.seoLocale.cookie ?? {}),
      },
    };
  }
  if (!options.sourceDir) options.sourceDir = 'dist';

  const log = createLogger(options.logLevel ?? 'info');
  const report = await prerender(options, { log });
  if (!report.ok) process.exitCode = 1;
}

/**
 * Translates parsed flags into prerender options, only including flags the user
 * actually passed so config-file values are never clobbered by defaults.
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
    ...(options.locales?.list
      ? {
          locales: {
            ...options.locales,
            list: options.locales.list.map((locale) => ({
              ...locale,
              storageState: resolve(locale.storageState),
            })),
          },
        }
      : {}),
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
