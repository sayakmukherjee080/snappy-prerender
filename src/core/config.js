import fs from 'node:fs';
import os from 'node:os';

/**
 * Upper bound applied to the derived default concurrency. Browser pages are memory
 * heavy, so the pool is capped even on machines with many cores; users can override
 * with the `concurrency` option.
 */
export const MAX_DEFAULT_CONCURRENCY = 8;

const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'];
const BROWSER_CHOICES = ['auto', 'chrome', 'msedge', 'chromium'];
const INLINE_CSS_STRATEGIES = [false, true, 'inline', 'critical'];
const SAVE_AS_CHOICES = ['html', 'png', 'jpeg'];
const NULLABLE_KEYS = [
  'storageState',
  'readySelector',
  'waitFor',
  'maxDepth',
  'notFoundRoute',
  'maxRoutes',
  'userAgent',
  'destination',
  'browserDownloadHash',
  'url',
  'serveCmd',
];
const ARRAY_KEYS = ['include', 'exclude', 'allowedHosts', 'browserArgs', 'ignoreForPreload'];

export const DEFAULTS = Object.freeze({
  sourceDir: 'dist',
  destination: null,
  base: '/',
  include: ['/'],
  exclude: [],
  crawl: true,
  maxDepth: null,
  maxRoutes: null,
  concurrency: null,
  timeout: 30000,
  quietPeriod: 500,
  scrollStepDelay: 100,
  shutdownTimeout: 5000,
  readyFlag: '__prerenderReady',
  readySelector: null,
  waitFor: null,
  viewport: Object.freeze({ width: 1280, height: 720 }),
  storageState: null,
  userAgent: 'SnappyPrerender',
  browser: 'auto',
  browserDownload: true,
  browserDownloadHash: null,
  browserArgs: [],
  headless: true,
  ignoreHTTPSErrors: false,
  blockThirdParty: false,
  allowedHosts: [],
  freezeAnimations: true,
  scrollToBottom: false,
  captureRuntimeStyles: true,
  captureFormState: true,
  saveAs: 'html',
  inlineCss: false,
  minifyHtml: false,
  minifyCss: false,
  removeBlobs: true,
  removeStyleTags: false,
  removeScriptTags: false,
  asyncScriptTags: false,
  preconnectThirdParty: true,
  preloadImages: false,
  preloadManifest: false,
  ignoreForPreload: ['service-worker.js'],
  cacheAjaxRequests: false,
  maxCachedBytes: 5 * 1024 * 1024,
  flatOutput: false,
  notFoundRoute: '/404',
  verify: true,
  failOnHydrationError: false,
  failOnRerender: false,
  failOnPageError: false,
  metadata: null,
  failOnError: true,
  dryRun: false,
  logLevel: 'info',
  url: null,
  serveCmd: null,
  serveCmdTimeout: 30000,
});

// Options whose default is boolean but which accept other shapes, so their own validators
// below decide what is allowed.
const MULTI_TYPE_KEYS = new Set(['inlineCss', 'minifyHtml', 'minifyCss']);

// Every boolean option is validated, derived from the defaults so a new flag cannot be
// forgotten in a hand-maintained list.
const BOOLEAN_KEYS = Object.entries(DEFAULTS)
  .filter(([key, value]) => typeof value === 'boolean' && !MULTI_TYPE_KEYS.has(key))
  .map(([key]) => key);

/**
 * Merges user options over defaults and normalises the values the rest of the
 * pipeline relies on, so downstream modules never repeat coercion logic.
 */
export function resolveConfig(userOptions = {}) {
  const config = { ...DEFAULTS, ...userOptions };
  for (const key of NULLABLE_KEYS) config[key] = config[key] ?? null;
  for (const key of ARRAY_KEYS) config[key] = toArray(config[key]);
  config.viewport = { ...DEFAULTS.viewport, ...(userOptions.viewport ?? {}) };
  config.base = normaliseBase(config.base);
  config.concurrency =
    userOptions.concurrency ??
    Math.max(1, Math.min(os.availableParallelism(), MAX_DEFAULT_CONCURRENCY));
  config.includeProvided = userOptions.include !== undefined;
  config.warnings = [];
  validateConfig(config);
  return config;
}

/**
 * Ensures the base path always carries a leading and trailing slash so route and
 * URL helpers can strip or append it without branching on user input shape.
 */
export function normaliseBase(base) {
  if (typeof base !== 'string' || base.length === 0) {
    throw new TypeError('base must be a non-empty string');
  }
  let value = base.startsWith('/') ? base : `/${base}`;
  if (!value.endsWith('/')) value = `${value}/`;
  return value;
}

/**
 * Reports whether a browser option is a filesystem path rather than a channel
 * choice. Shared by validation and browser resolution so both agree on the shape.
 */
export function isExecutablePath(value) {
  return typeof value === 'string' && (value.includes('/') || value.includes('\\'));
}

// Normalises a single value or list option into an array, treating null as empty.
function toArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Fails fast on configuration mistakes before any browser or server work starts,
 * so misconfiguration surfaces as a clear message instead of a mid-run timeout.
 */
export function validateConfig(config) {
  // Validates that a pattern list only holds strings or RegExp instances.
  const patternList = (list, name) => {
    for (const entry of list) {
      const valid = typeof entry === 'string' || entry instanceof RegExp;
      if (!valid) throw new TypeError(`${name} entries must be strings or RegExp instances`);
    }
  };
  // Validates that a plain list only holds strings.
  const stringList = (list, name) => {
    for (const entry of list) {
      if (typeof entry !== 'string') throw new TypeError(`${name} entries must be strings`);
    }
  };
  // Validates that an optional value is either absent or a string.
  const nullableString = (key) => {
    if (config[key] !== null && typeof config[key] !== 'string') {
      throw new TypeError(`${key} must be a string or null`);
    }
  };
  // Validates that a flag option is a real boolean.
  const booleanOption = (key) => {
    if (typeof config[key] !== 'boolean') throw new TypeError(`${key} must be a boolean`);
  };

  patternList(config.include, 'include');
  patternList(config.exclude, 'exclude');
  stringList(config.allowedHosts, 'allowedHosts');
  stringList(config.browserArgs, 'browserArgs');
  stringList(config.ignoreForPreload, 'ignoreForPreload');
  for (const key of ['readyFlag', 'readySelector', 'waitFor', 'notFoundRoute']) nullableString(key);
  for (const key of ['userAgent', 'destination']) nullableString(key);
  for (const key of BOOLEAN_KEYS) booleanOption(key);

  if (config.browserDownloadHash !== null && !/^[a-f0-9]{64}$/i.test(config.browserDownloadHash)) {
    throw new TypeError('browserDownloadHash must be a 64 character SHA-256 hex digest');
  }

  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    throw new TypeError('concurrency must be a positive integer');
  }
  for (const key of [
    'timeout',
    'quietPeriod',
    'scrollStepDelay',
    'shutdownTimeout',
    'serveCmdTimeout',
  ]) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) {
      throw new TypeError(`${key} must be a positive number of milliseconds`);
    }
  }
  if (config.maxDepth !== null && (!Number.isInteger(config.maxDepth) || config.maxDepth < 0)) {
    throw new TypeError('maxDepth must be null or a non-negative integer');
  }
  if (config.maxRoutes !== null && (!Number.isInteger(config.maxRoutes) || config.maxRoutes < 1)) {
    throw new TypeError('maxRoutes must be null or a positive integer');
  }
  if (!Number.isFinite(config.maxCachedBytes) || config.maxCachedBytes <= 0) {
    throw new TypeError('maxCachedBytes must be a positive number of bytes');
  }
  for (const key of ['width', 'height']) {
    if (!Number.isInteger(config.viewport[key]) || config.viewport[key] < 1) {
      throw new TypeError(`viewport.${key} must be a positive integer`);
    }
  }
  if (!LOG_LEVELS.includes(config.logLevel)) {
    throw new TypeError(`logLevel must be one of: ${LOG_LEVELS.join(', ')}`);
  }
  if (!BROWSER_CHOICES.includes(config.browser) && !isExecutablePath(config.browser)) {
    throw new TypeError(
      `browser must be one of: ${BROWSER_CHOICES.join(', ')} or a path to an executable`,
    );
  }
  if (config.storageState !== null) {
    if (typeof config.storageState !== 'string' || !fs.existsSync(config.storageState)) {
      throw new TypeError('storageState must point to an existing Playwright storage state file');
    }
  }
  if (config.serveCmd !== null && !config.url) {
    throw new TypeError(
      'url is required when serveCmd is set, so the crawler knows where to connect',
    );
  }
  if (config.url !== null && !/^https?:\/\//.test(config.url)) {
    throw new TypeError('url must be an absolute http(s) URL');
  }
  if (!INLINE_CSS_STRATEGIES.includes(config.inlineCss)) {
    throw new TypeError("inlineCss must be false, true, 'inline' or 'critical'");
  }
  for (const key of ['minifyHtml', 'minifyCss']) {
    const value = config[key];
    const valid =
      typeof value === 'boolean' ||
      (typeof value === 'object' && value !== null && !Array.isArray(value));
    if (!valid) throw new TypeError(`${key} must be a boolean or an options object`);
  }
  if (!SAVE_AS_CHOICES.includes(config.saveAs)) {
    throw new TypeError(`saveAs must be one of: ${SAVE_AS_CHOICES.join(', ')}`);
  }
  validateMetadata(config);
}

// The metadata keys the head component reads, so a typo is reported instead of ignored.
const METADATA_KEYS = new Set([
  'siteUrl',
  'siteName',
  'titleTemplate',
  'defaultImage',
  'trailingSlash',
  'base',
]);

/**
 * Validates the defaults handed to the head component, so a typo surfaces at config time
 * rather than as metadata that silently points at the build server.
 */
function validateMetadata(config) {
  const metadata = config.metadata;
  if (metadata === null) return;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be null or an options object');
  }
  for (const key of Object.keys(metadata)) {
    if (!METADATA_KEYS.has(key)) throw new TypeError(`metadata.${key} is not a recognised option`);
  }
  for (const key of METADATA_KEYS) {
    const value = metadata[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new TypeError(`metadata.${key} must be a string`);
    }
  }
  if (metadata.siteUrl && !/^https?:\/\//.test(metadata.siteUrl)) {
    throw new TypeError('metadata.siteUrl must be an absolute http(s) URL');
  }
  if (metadata.base && !metadata.base.startsWith('/')) {
    throw new TypeError('metadata.base must start with a slash, for example /app/');
  }
  if (metadata.trailingSlash && !['preserve', 'always', 'never'].includes(metadata.trailingSlash)) {
    throw new TypeError("metadata.trailingSlash must be 'preserve', 'always' or 'never'");
  }
  if (metadata.titleTemplate && !metadata.titleTemplate.includes('%s')) {
    config.warnings ??= [];
    config.warnings.push(
      'metadata.titleTemplate has no %s placeholder, so the title is left as the page set it',
    );
  }
}
