import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { resolveConfig } from './core/config.js';
import {
  CONFIG_FILE,
  configValuesFromAnswers,
  detectProjectDefaults,
  PACKAGE_NAME,
  parseRouteList,
  renderConfigFile,
  writeConfigFile,
} from './core/init.js';

/**
 * Setup wizard: asks for the handful of values that decide what gets prerendered and what the
 * metadata says, then writes snappy.config.js. Flags cover every question, so
 * `snappy-prerender init --yes --metadata-site-url https://example.com` works without a
 * terminal.
 */
export async function runInit({ values, flags, log, version }) {
  const cwd = process.cwd();
  if (!values.force && fs.existsSync(CONFIG_FILE)) {
    throw new Error(`${CONFIG_FILE} already exists; pass --force to replace it`);
  }
  if (!values.yes && !process.stdin.isTTY) {
    throw new Error('init needs an interactive terminal; pass --yes to accept the defaults');
  }

  const detected = await detectProjectDefaults(cwd);
  const defaults = defaultsFromFlags(detected, flags);
  const answers = values.yes ? defaults : await askAnswers(defaults, log);
  const cleaned = validatedAnswers(answers, log);
  // Validate what will be written before touching an existing config file.
  resolveConfig(configValuesFromAnswers(cleaned));

  await writeConfigFile({
    dir: cwd,
    contents: renderConfigFile(cleaned),
    force: values.force === true,
  });
  log.success(`Wrote ${CONFIG_FILE}`);
  if (detected.reactSnap) printReactSnapMapping(detected.reactSnap, log);
  printNextSteps({ detected, log, tag: version.includes('-') ? '@next' : '' });
}

// Turns the flags the CLI already understands into the wizard's starting answers.
function defaultsFromFlags(detected, flags) {
  const mapped = detected.reactSnap?.values ?? {};
  // Options the wizard renders itself stay out of the generic list.
  const handled = new Set(['sourceDir', 'include', 'crawl', 'csp', 'externalScripts']);
  const extraOptions = Object.fromEntries(
    Object.entries(mapped).filter(([key]) => !handled.has(key) && key !== 'criticalCssPreload'),
  );
  return {
    ...mapped,
    sourceDir: flags.sourceDir ?? mapped.sourceDir ?? detected.sourceDir,
    base: flags.base ?? detected.base ?? '/',
    include: includeList(flags.include ?? mapped.include),
    crawl: flags.crawl ?? mapped.crawl ?? true,
    siteUrl: flags.metadata?.siteUrl ?? '',
    siteName: flags.metadata?.siteName ?? '',
    titleTemplate: flags.metadata?.titleTemplate ?? '',
    defaultImage: flags.metadata?.defaultImage ?? '',
    trailingSlash: flags.metadata?.trailingSlash ?? '',
    csp: flags.csp ?? 'off',
    externalScripts: flags.externalScripts,
    criticalCssPreload: flags.criticalCssPreload ?? mapped.criticalCssPreload,
    extraOptions,
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
        defaults.csp === 'strict' || defaults.csp === 'hash',
      ))
        ? defaults.csp === 'hash'
          ? 'hash'
          : 'strict'
        : 'off',
      defaultImage: defaults.defaultImage,
      trailingSlash: defaults.trailingSlash,
      extraOptions: defaults.extraOptions ?? {},
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
  cleaned.include = parseRouteList(
    Array.isArray(cleaned.include) ? cleaned.include.join(',') : (cleaned.include ?? '/'),
  );
  return cleaned;
}

// Accepts the array, comma-separated string or absent include value from every source.
function includeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return parseRouteList(value);
  return ['/'];
}

// Prints what the wizard carried over from a legacy react-snap block, and what it did not.
function printReactSnapMapping(reactSnap, log) {
  log.info('');
  log.info('react-snap migration:');
  if (reactSnap.mapping.length === 0) log.info('  no options carried over');
  for (const { from, to, value } of reactSnap.mapping) {
    log.info(`  reactSnap.${from} -> ${to} = ${JSON.stringify(value)}`);
  }
  for (const { key, reason } of reactSnap.ignored) {
    log.warn(`  ignored reactSnap.${key}: ${reason}`);
  }
  for (const key of reactSnap.unknown) {
    log.warn(`  unknown reactSnap.${key} was not migrated`);
  }
}

// Prints what to do next: install if needed, run it, and where the head layer goes.
function printNextSteps({ detected, log, tag = '' }) {
  const run = runnerCommand(detected.runner, PACKAGE_NAME);
  const install = installCommand(detected.runner, tag);
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
function installCommand(runner, tag = '') {
  const pkg = `${PACKAGE_NAME}${tag}`;
  if (runner === 'pnpm') return `pnpm add -D ${pkg}`;
  if (runner === 'yarn') return `yarn add -D ${pkg}`;
  return `npm install --save-dev ${pkg}`;
}
