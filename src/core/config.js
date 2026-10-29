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
const CSP_MODES = ['off', 'strict', 'hash'];
const FRAMEWORK_CHOICES = ['auto', 'react', 'vue', 'svelte', 'preact'];
const SAVE_AS_CHOICES = ['html', 'png', 'jpeg'];
const CRITICAL_CSS_PRELOAD = ['body', 'media', 'swap', 'swap-high', 'swap-low', 'js', 'js-lazy'];
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
  'browserDownloadVersion',
  'url',
  'serveCmd',
  'reportPath',
  'routesFile',
  'routesFromSitemap',
  'transformHtml',
];
const ARRAY_KEYS = [
  'include',
  'exclude',
  'allowedHosts',
  'browserArgs',
  'ignoreForPreload',
  'removeAttributes',
  'auditIgnoreLinks',
  'routePriority',
  'routeOverrides',
];

export const DEFAULTS = Object.freeze({
  sourceDir: 'dist',
  destination: null,
  cleanDestination: false,
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
  browserDownloadVersion: null,
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
  csp: 'off',
  inlineCss: false,
  criticalCssPreload: 'media',
  minifyHtml: false,
  minifyCss: false,
  removeBlobs: true,
  removeAttributes: [],
  removeStyleTags: false,
  removeScriptTags: false,
  asyncScriptTags: false,
  externalScripts: false,
  preconnectThirdParty: true,
  preloadImages: false,
  preloadManifest: false,
  sitemap: false,
  imageSitemap: false,
  ignoreForPreload: ['service-worker.js'],
  cacheAjaxRequests: false,
  maxCachedBytes: 5 * 1024 * 1024,
  flatOutput: false,
  notFoundRoute: '/404',
  audit: true,
  failOnAuditError: false,
  auditIgnoreLinks: [],
  reportPath: null,
  routePriority: [],
  routeOverrides: [],
  transformHtml: null,
  routesFile: null,
  routesFromSitemap: null,
  preloadLinks: false,
  retries: 0,
  retryDelay: 500,
  traceOnError: false,
  framework: 'auto',
  verify: true,
  verifyChangedOnly: false,
  reuseVerificationContext: false,
  failOnHydrationError: false,
  failOnRerender: false,
  failOnPageError: false,
  failOnEmptyPage: true,
  failOnUndetected: false,
  failOnVerificationError: false,
  failOnConsoleError: false,
  failOnFailedRequest: false,
  failOnDuplicateContent: false,
  stripBuildOriginMetadata: true,
  failOnBuildOriginMetadata: false,
  pruneStaleRoutes: false,
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

// Freeze the nested list defaults as well, so a consumer cannot mutate the defaults
// used by every later run in the same process.
for (const key of [
  'include',
  'exclude',
  'allowedHosts',
  'browserArgs',
  'ignoreForPreload',
  'removeAttributes',
  'auditIgnoreLinks',
  'routePriority',
  'routeOverrides',
]) {
  Object.freeze(DEFAULTS[key]);
}

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
  config.includeProvided =
    userOptions.include !== undefined &&
    !(config.include.length === 1 && config.include[0] === '/');
  // The CSP dial decides the defaults for the pieces that can move. Explicit options still
  // win, so a project can take 'strict' and put one part back.
  if (userOptions.externalScripts === undefined) {
    config.externalScripts = config.csp === 'strict' || config.csp === 'hash';
  }
  if (userOptions.criticalCssPreload === undefined) {
    config.criticalCssPreload = config.csp === 'strict' || config.csp === 'hash' ? false : 'media';
  }
  config.warnings = [];
  validateConfig(config);
  addConfigWarnings(config, userOptions);
  return config;
}

/**
 * Reports options that do nothing in the current combination, so a build does not
 * quietly skip a gate the caller believes is active.
 */
function addConfigWarnings(config, userOptions) {
  const warn = (message) => config.warnings.push(message);
  for (const key of Object.keys(userOptions)) {
    if (!Object.hasOwn(DEFAULTS, key)) {
      warn(`unknown option "${key}" is ignored; check the spelling`);
    }
  }
  if (!config.verify) {
    for (const key of [
      'verifyChangedOnly',
      'failOnHydrationError',
      'failOnRerender',
      'failOnUndetected',
      'failOnVerificationError',
    ]) {
      if (config[key]) warn(`${key} has no effect because verify is false`);
    }
  }
  if (config.verify && (config.serveCmd || config.saveAs !== 'html')) {
    for (const key of [
      'failOnHydrationError',
      'failOnRerender',
      'failOnUndetected',
      'failOnVerificationError',
    ]) {
      if (config[key]) {
        warn(
          `${key} has no effect because hydration verification is skipped with ${config.serveCmd ? 'serveCmd' : `saveAs: '${config.saveAs}'`}`,
        );
      }
    }
    if (userOptions.framework !== undefined) {
      warn(
        `framework has no effect because hydration verification is skipped with ${config.serveCmd ? 'serveCmd' : `saveAs: '${config.saveAs}'`}`,
      );
    }
  }
  if (!config.verify && userOptions.framework !== undefined) {
    warn('framework has no effect because verify is false');
  }
  if (!config.verify && config.reuseVerificationContext) {
    warn('reuseVerificationContext has no effect because verify is false');
  }
  if (config.reuseVerificationContext && config.storageState) {
    warn(
      'reuseVerificationContext shares browser storage across routes; authenticated routes may see state from another route',
    );
  }
  if (!config.audit && config.failOnAuditError) {
    warn('failOnAuditError has no effect because audit is false');
  }
  if (!config.audit && config.auditIgnoreLinks.length > 0) {
    warn('auditIgnoreLinks has no effect because audit is false');
  }
  if (config.preloadLinks && config.saveAs !== 'html') {
    warn(`preloadLinks has no effect when saveAs is '${config.saveAs}'`);
  }
  if (config.preloadLinks && config.removeScriptTags) {
    warn('preloadLinks skips script hints because removeScriptTags strips every script');
  }
  if (config.imageSitemap && !config.sitemap) {
    warn('imageSitemap has no effect because sitemap is false');
  }
  if (config.traceOnError && config.dryRun) {
    warn('traceOnError has no effect in dry-run mode');
  }
  if (
    userOptions.criticalCssPreload !== undefined &&
    config.criticalCssPreload !== false &&
    config.inlineCss !== 'critical'
  ) {
    warn('criticalCssPreload has no effect unless inlineCss is "critical"');
  }
  if (config.minifyCss && !config.minifyHtml && !config.inlineCss) {
    warn('minifyCss has no effect unless minifyHtml or inlineCss is enabled');
  }
  if (config.allowedHosts.length > 0 && !config.blockThirdParty) {
    warn('allowedHosts has no effect unless blockThirdParty is true');
  }
  if (config.csp === 'strict' && config.inlineCss) {
    warn(
      "csp controls script-src; inlineCss emits inline styles, which need style-src 'unsafe-inline' or hashes",
    );
  }
  if (
    (config.csp === 'strict' || config.csp === 'hash') &&
    userOptions.criticalCssPreload !== undefined &&
    config.criticalCssPreload !== false
  ) {
    warn(
      "criticalCssPreload emits an inline onload handler that a script-src 'self' policy blocks",
    );
  }
  if (config.removeStyleTags && config.inlineCss === 'critical') {
    warn('removeStyleTags removes CSS-in-JS styles before critical CSS is extracted');
  }
  if (config.sitemap && config.saveAs !== 'html') {
    warn(`sitemap has no effect when saveAs is '${config.saveAs}'`);
  }
  const metadataBase = config.metadata?.base;
  if (metadataBase && metadataBase !== config.base) {
    warn(
      `metadata.base (${metadataBase}) differs from base (${config.base}); canonical, social URLs and routing will disagree`,
    );
  }
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
  patternList(config.removeAttributes, 'removeAttributes');
  patternList(config.auditIgnoreLinks, 'auditIgnoreLinks');
  patternList(config.routePriority, 'routePriority');
  for (const key of [
    'readyFlag',
    'readySelector',
    'waitFor',
    'notFoundRoute',
    'reportPath',
    'routesFile',
    'routesFromSitemap',
  ]) {
    nullableString(key);
  }
  for (const key of ['userAgent', 'destination', 'browserDownloadVersion']) nullableString(key);
  if (config.transformHtml !== null && typeof config.transformHtml !== 'function') {
    throw new TypeError('transformHtml must be a function or null');
  }
  for (const key of BOOLEAN_KEYS) booleanOption(key);
  validateRouteOverrides(config.routeOverrides);

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
  if (!Number.isInteger(config.retries) || config.retries < 0) {
    throw new TypeError('retries must be a non-negative integer');
  }
  if (!Number.isFinite(config.retryDelay) || config.retryDelay <= 0) {
    throw new TypeError('retryDelay must be a positive number of milliseconds');
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
  if (!FRAMEWORK_CHOICES.includes(config.framework)) {
    throw new TypeError(`framework must be one of: ${FRAMEWORK_CHOICES.join(', ')}`);
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
  if (config.serveCmd !== null && config.url) {
    const parsed = new URL(config.url);
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      throw new TypeError(
        'url must be an origin without a path when serveCmd is used; set base for a sub-path deployment',
      );
    }
  }
  if (!INLINE_CSS_STRATEGIES.includes(config.inlineCss)) {
    throw new TypeError("inlineCss must be false, true, 'inline' or 'critical'");
  }
  if (!CSP_MODES.includes(config.csp)) {
    throw new TypeError(`csp must be one of: ${CSP_MODES.join(', ')}`);
  }
  if (
    config.criticalCssPreload !== false &&
    !CRITICAL_CSS_PRELOAD.includes(config.criticalCssPreload)
  ) {
    throw new TypeError(
      `criticalCssPreload must be false or one of: ${CRITICAL_CSS_PRELOAD.join(', ')}`,
    );
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
  if (config.removeStyleTags && (config.inlineCss === true || config.inlineCss === 'inline')) {
    throw new TypeError(
      "removeStyleTags cannot be combined with inlineCss 'inline' or true: it would strip the CSS the inline step just added",
    );
  }
  validateMetadata(config);
  if (config.sitemap && !config.metadata?.siteUrl) {
    throw new TypeError('sitemap needs metadata.siteUrl so the sitemap can list absolute URLs');
  }
}

// Per-route overrides may only change the settings that make sense for one route.
const ROUTE_OVERRIDE_KEYS = new Set([
  'match',
  'timeout',
  'waitFor',
  'readySelector',
  'readyFlag',
  'crawl',
  'storageState',
]);

/**
 * Validates per-route overrides. Matching patterns stay strings or RegExp; every
 * override key is checked so a typo cannot silently leave the base config in place.
 */
function validateRouteOverrides(overrides) {
  for (const override of overrides) {
    if (typeof override !== 'object' || override === null || Array.isArray(override)) {
      throw new TypeError('routeOverrides entries must be objects');
    }
    for (const key of Object.keys(override)) {
      if (!ROUTE_OVERRIDE_KEYS.has(key)) {
        throw new TypeError(`routeOverrides.${key} is not a recognised option`);
      }
    }
    if (!(typeof override.match === 'string' || override.match instanceof RegExp)) {
      throw new TypeError('routeOverrides entries need a string or RegExp match');
    }
    if (override.timeout !== undefined) {
      if (!Number.isFinite(override.timeout) || override.timeout <= 0) {
        throw new TypeError('routeOverrides.timeout must be a positive number of milliseconds');
      }
    }
    for (const key of ['waitFor', 'readySelector', 'readyFlag', 'storageState']) {
      const value = override[key];
      if (value !== undefined && typeof value !== 'string') {
        throw new TypeError(`routeOverrides.${key} must be a string`);
      }
    }
    if (override.crawl !== undefined && typeof override.crawl !== 'boolean') {
      throw new TypeError('routeOverrides.crawl must be a boolean');
    }
  }
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
  if (metadata.siteUrl) {
    const parsed = new URL(metadata.siteUrl);
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      throw new TypeError(
        'metadata.siteUrl must be an origin without a path; set base for a sub-path deployment',
      );
    }
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
