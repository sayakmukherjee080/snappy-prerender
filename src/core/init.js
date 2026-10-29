import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS } from './config.js';
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

// react-snap options whose name differs here, mapped to this package's option.
const REACT_SNAP_RENAMED = {
  source: 'sourceDir',
  puppeteerArgs: 'browserArgs',
  puppeteerIgnoreHTTPSErrors: 'ignoreHTTPSErrors',
  skipThirdPartyRequests: 'blockThirdParty',
  fixInsertRule: 'captureRuntimeStyles',
  fixFormFields: 'captureFormState',
  http2PushManifest: 'preloadManifest',
};

// react-snap options that keep their name and meaning.
const REACT_SNAP_PASSTHROUGH = new Set([
  'include',
  'exclude',
  'crawl',
  'concurrency',
  'timeout',
  'waitFor',
  'inlineCss',
  'minifyHtml',
  'minifyCss',
  'cacheAjaxRequests',
  'preconnectThirdParty',
  'preloadImages',
  'removeBlobs',
  'removeStyleTags',
  'removeScriptTags',
  'asyncScriptTags',
  'userAgent',
  'viewport',
  'saveAs',
  'destination',
]);

// react-snap options that cannot be carried over, with the reason shown to the user.
const REACT_SNAP_IGNORED = {
  port: 'the prerenderer serves the build itself on an ephemeral port',
  sourceMaps: 'react-snap declares it but never uses it',
};

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
  const detected = {
    sourceDir: vite?.sourceDir ?? (usesCreateReactApp ? 'build' : 'dist'),
    base: vite?.base ?? homepageBase(manifest?.homepage) ?? '/',
    usesVite,
    runner: await detectRunner(dir),
    installed: PACKAGE_NAME in dependencies,
  };
  const reactSnap = mapReactSnapOptions(manifest?.reactSnap);
  if (reactSnap) detected.reactSnap = reactSnap;
  return detected;
}

/**
 * Maps a legacy react-snap block onto this package's options. The result lists what
 * carried over, what was deliberately dropped and what was not recognised, so the
 * wizard can explain the migration instead of guessing.
 */
export function mapReactSnapOptions(block) {
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return null;
  const values = {};
  const mapping = [];
  const ignored = [];
  const unknown = [];
  for (const [key, value] of Object.entries(block)) {
    if (Object.hasOwn(REACT_SNAP_IGNORED, key)) {
      ignored.push({ key, reason: REACT_SNAP_IGNORED[key] });
      continue;
    }
    const target = REACT_SNAP_RENAMED[key] ?? (REACT_SNAP_PASSTHROUGH.has(key) ? key : null);
    if (target === null) {
      unknown.push(key);
      continue;
    }
    // JSON cannot carry functions or RegExp, but a hand-written manifest may.
    if (!isSerialisable(value)) {
      unknown.push(`${key} (unsupported value)`);
      continue;
    }
    const mappedValue =
      target === 'include' && typeof value === 'string' ? parseRouteList(value) : value;
    values[target] = mappedValue;
    mapping.push({ from: key, to: target, value: mappedValue });
  }
  return { values, mapping, ignored, unknown };
}

// Reports whether a value can be written into a JavaScript config file.
function isSerialisable(value) {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isSerialisable);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).every(isSerialisable);
  }
  return false;
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
 * Turns the wizard's answers into the options object the generated config will export.
 * Only values that change a default are included, and only options the resolver knows.
 */
export function configValuesFromAnswers(answers = {}) {
  const values = { sourceDir: answers.sourceDir ?? 'dist' };
  if (answers.base && answers.base !== '/') values.base = answers.base;
  // A supplied include list acts as an allowlist, so writing the default would stop discovery.
  const includeValue = answers.include ?? ['/'];
  const include = parseRouteList(
    Array.isArray(includeValue) ? includeValue.join(',') : includeValue,
  );
  const includeIsDefault = include.length === 1 && include[0] === '/';
  if (!includeIsDefault) values.include = include;
  if (answers.crawl === false) values.crawl = false;
  if (answers.csp === 'strict' || answers.csp === 'hash') values.csp = answers.csp;
  if (answers.externalScripts === true) values.externalScripts = true;
  if (answers.criticalCssPreload !== undefined && answers.criticalCssPreload !== 'media') {
    values.criticalCssPreload = answers.criticalCssPreload;
  }

  const metadata = METADATA_KEYS.filter((key) => answers[key]).map((key) => [key, answers[key]]);
  if (metadata.length > 0) values.metadata = Object.fromEntries(metadata);

  for (const [key, value] of Object.entries(answers.extraOptions ?? {})) {
    if (!Object.hasOwn(DEFAULTS, key) || key === 'metadata') continue;
    if (Object.hasOwn(values, key)) continue;
    if (!isSerialisable(value)) continue;
    values[key] = value;
  }
  return values;
}

/**
 * Renders the config file for the wizard's answers, writing only the options the answers
 * actually set so every line in the file does something.
 */
export function renderConfigFile(answers = {}) {
  const values = configValuesFromAnswers(answers);
  const lines = [
    '// Created by `snappy-prerender init`. Every option is documented in the snappy-prerender README.',
    'export default {',
  ];
  for (const [key, value] of Object.entries(values)) {
    if (key !== 'metadata') {
      lines.push(`  ${key}: ${serializeValue(value)},`);
      continue;
    }
    lines.push('  metadata: {');
    for (const [metadataKey, metadataValue] of Object.entries(value)) {
      lines.push(`    ${metadataKey}: ${serializeValue(metadataValue)},`);
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

// Writes a JSON-compatible value as JavaScript source with a stable, readable shape.
function serializeValue(value) {
  if (Array.isArray(value)) return `[${value.map(serializeValue).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, entry]) => `${key}: ${serializeValue(entry)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value);
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
