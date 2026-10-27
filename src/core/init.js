import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normaliseRoute } from './routes.js';

export const CONFIG_FILE = 'snappy.config.js';
export const PACKAGE_NAME = 'snappy-prerender';

const VITE_CONFIGS = ['vite.config.js', 'vite.config.mjs', 'vite.config.cjs', 'vite.config.ts'];
const METADATA_KEYS = ['siteUrl', 'siteName', 'titleTemplate', 'defaultImage', 'trailingSlash'];
const RUNNERS = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

/**
 * Reads what the project already says about itself: the framework that decides the build
 * directory, whether Vite is in use, which package runner it uses, and whether this package
 * is already a dependency.
 */
export async function detectProjectDefaults(dir = process.cwd()) {
  const manifest = await readJson(path.join(dir, 'package.json'));
  const dependencies = { ...manifest?.dependencies, ...manifest?.devDependencies };
  const usesVite = Boolean(dependencies.vite) || (await anyExists(dir, VITE_CONFIGS));
  const usesCreateReactApp = Boolean(dependencies['react-scripts']) && !usesVite;
  const vite = usesVite ? await detectViteConfig(dir) : null;
  return {
    sourceDir: vite?.sourceDir ?? (usesCreateReactApp ? 'build' : 'dist'),
    base: vite?.base ?? homepageBase(manifest?.homepage) ?? '/',
    usesVite,
    runner: await detectRunner(dir),
    installed: PACKAGE_NAME in dependencies,
  };
}

/**
 * Reads the project's real Vite output directory and base when Vite can be resolved
 * from that project. Falls back to the conventional defaults when the config is
 * missing, imports an unavailable plugin, or Vite is not installed.
 */
async function detectViteConfig(dir) {
  try {
    const require = createRequire(path.join(dir, 'package.json'));
    const entry = require.resolve('vite');
    const { resolveConfig } = await import(pathToFileURL(entry).href);
    const resolved = await resolveConfig({ root: dir, logLevel: 'silent' }, 'build');
    const relative = path.relative(dir, resolved.build.outDir);
    return {
      sourceDir: relative.startsWith('..') ? resolved.build.outDir : relative || '.',
      base: detectedBase(resolved.base),
    };
  } catch {
    return null;
  }
}

// Keeps a detected base usable by normaliseBase: only root-relative bases apply here.
function detectedBase(base) {
  if (typeof base !== 'string' || !base.startsWith('/') || base.startsWith('//')) return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

// Reads Create React App's homepage into a base path, ignoring absolute deployments
// and values that are not a path.
function homepageBase(homepage) {
  if (typeof homepage !== 'string' || homepage.length === 0) return null;
  try {
    const url = new URL(homepage, 'https://example.invalid');
    return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  } catch {
    return null;
  }
}

/**
 * Normalises a comma separated route list into include patterns, keeping wildcards as the
 * user wrote them and falling back to the root route so the config always renders something.
 */
export function parseRouteList(input) {
  const routes = String(input ?? '')
    .split(',')
    .map((route) => route.trim())
    .filter((route) => route.length > 0)
    .map((route) => (route.includes('*') ? route : normaliseRoute(route)));
  return routes.length > 0 ? routes : ['/'];
}

/**
 * Renders the config file for the wizard's answers, writing only the options the answers
 * actually set so every line in the file does something.
 */
export function renderConfigFile(answers = {}) {
  const lines = [
    '// Created by `snappy-prerender init`. Every option is documented in the snappy-prerender README.',
    'export default {',
    `  sourceDir: ${quote(answers.sourceDir ?? 'dist')},`,
  ];
  if (answers.base && answers.base !== '/') lines.push(`  base: ${quote(answers.base)},`);
  // A supplied include list acts as an allowlist, so writing the default would stop discovery.
  // It is only written when the answer actually narrows the set of routes.
  const include = parseRouteList((answers.include ?? ['/']).join(','));
  const includeIsDefault = include.length === 1 && include[0] === '/';
  if (!includeIsDefault) lines.push(`  include: [${include.map(quote).join(', ')}],`);
  if (answers.crawl === false) lines.push('  crawl: false,');
  // The CSP dial and the parts it was tuned with, so a strict-CSP project keeps the choice.
  if (answers.csp === 'strict') lines.push('  csp: "strict",');
  if (answers.externalScripts === true) lines.push('  externalScripts: true,');
  if (answers.criticalCssPreload !== undefined && answers.criticalCssPreload !== 'media') {
    // A boolean stays a literal; a mode name is quoted.
    const value =
      typeof answers.criticalCssPreload === 'boolean'
        ? String(answers.criticalCssPreload)
        : quote(answers.criticalCssPreload);
    lines.push(`  criticalCssPreload: ${value},`);
  }

  const metadata = METADATA_KEYS.filter((key) => answers[key]).map((key) => [key, answers[key]]);
  if (metadata.length > 0) {
    lines.push('  metadata: {');
    for (const [key, value] of metadata) lines.push(`    ${key}: ${quote(value)},`);
    lines.push('  },');
  }

  lines.push('};', '');
  return lines.join('\n');
}

/**
 * Writes the config file into the project, refusing to replace an existing one unless the
 * caller asked for it, so a wizard run can never silently destroy hand-written settings.
 */
export async function writeConfigFile({ dir, contents, force = false }) {
  const target = path.join(dir, CONFIG_FILE);
  if (!force && (await exists(target))) {
    throw new Error(`${CONFIG_FILE} already exists; pass --force to replace it`);
  }
  await fs.writeFile(target, contents, 'utf8');
  return target;
}

// Quotes a string for the generated module.
function quote(value) {
  return JSON.stringify(String(value));
}

// Reads a JSON file, treating a missing or malformed file as absent.
async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

// Reports whether any of the given file names exists in the directory.
async function anyExists(dir, names) {
  for (const name of names) {
    if (await exists(path.join(dir, name))) return true;
  }
  return false;
}

// Reports whether a path exists.
async function exists(target) {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
}

// Detects the package runner from the lockfile, defaulting to npm.
async function detectRunner(dir) {
  for (const [lockfile, runner] of RUNNERS) {
    if (await exists(path.join(dir, lockfile))) return runner;
  }
  return 'npm';
}
