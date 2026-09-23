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
const NULLABLE_KEYS = [
  'storageState',
  'readySelector',
  'waitFor',
  'maxDepth',
  'notFoundRoute',
  'url',
  'serveCmd',
];

export const DEFAULTS = Object.freeze({
  sourceDir: 'dist',
  base: '/',
  include: ['/'],
  exclude: [],
  crawl: true,
  maxDepth: null,
  concurrency: null,
  timeout: 30000,
  quietPeriod: 500,
  scrollStepDelay: 100,
  shutdownTimeout: 5000,
  readyFlag: '__prerenderReady',
  readySelector: null,
  waitFor: null,
  viewport: { width: 1280, height: 720 },
  storageState: null,
  browser: 'auto',
  browserDownload: true,
  headless: true,
  blockThirdParty: true,
  allowedHosts: [],
  freezeAnimations: true,
  scrollToBottom: false,
  flatOutput: false,
  notFoundRoute: '/404',
  verify: true,
  failOnHydrationError: true,
  failOnError: true,
  dryRun: false,
  logLevel: 'info',
  url: null,
  serveCmd: null,
  serveCmdTimeout: 30000,
  includeProvided: false,
});

/**
 * Merges user options over defaults and normalises the values the rest of the
 * pipeline relies on, so downstream modules never repeat coercion logic.
 */
export function resolveConfig(userOptions = {}) {
  const config = { ...DEFAULTS, ...userOptions };
  for (const key of NULLABLE_KEYS) config[key] = config[key] ?? null;
  config.viewport = { ...DEFAULTS.viewport, ...(userOptions.viewport ?? {}) };
  config.base = normaliseBase(config.base);
  config.include = toArray(config.include);
  config.exclude = toArray(config.exclude);
  config.allowedHosts = toArray(config.allowedHosts);
  config.concurrency =
    userOptions.concurrency ??
    Math.max(1, Math.min(os.availableParallelism(), MAX_DEFAULT_CONCURRENCY));
  config.includeProvided = userOptions.include !== undefined;
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

  patternList(config.include, 'include');
  patternList(config.exclude, 'exclude');
  stringList(config.allowedHosts, 'allowedHosts');
  for (const key of ['readyFlag', 'readySelector', 'waitFor', 'notFoundRoute']) nullableString(key);

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
}
