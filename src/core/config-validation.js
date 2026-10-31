import fs from 'node:fs';

const ROUTE_OVERRIDE_KEYS = new Set([
  'match',
  'timeout',
  'waitFor',
  'readySelector',
  'readyFlag',
  'crawl',
  'storageState',
  'hydration',
]);

/**
 * Validates per-route overrides. Matching patterns stay strings or RegExp; every
 * override key is checked so a typo cannot silently leave the base config in place.
 */
export function validateRouteOverrides(overrides) {
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
    if (
      override.hydration !== undefined &&
      !['strict', 'allow-rerender', 'skip'].includes(override.hydration)
    ) {
      throw new TypeError("routeOverrides.hydration must be 'strict', 'allow-rerender' or 'skip'");
    }
  }
}

/**
 * Reports whether a value is a plain object rather than an array or null.
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reports whether a value is a valid language tag.
 * @param {unknown} code
 * @returns {boolean}
 */
function validLocaleCode(code) {
  if (typeof code !== 'string' || code.length === 0) return false;
  try {
    return Intl.getCanonicalLocales(code).length === 1;
  } catch {
    return false;
  }
}

/**
 * Reports whether a value is a valid IANA timezone.
 * @param {unknown} timezone
 * @returns {boolean}
 */
function validTimezone(timezone) {
  if (typeof timezone !== 'string' || timezone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a list of route patterns.
 * @param {Array<string | RegExp>} list
 * @param {string} name
 */
function validPatternList(list, name) {
  for (const entry of list) {
    if (typeof entry !== 'string' && !(entry instanceof RegExp)) {
      throw new TypeError(`${name} entries must be strings or RegExp instances`);
    }
  }
}

// Validates the deterministic build clock and timezone controls.
export function validateClock(config) {
  const value = config.freezeTime;
  if (value !== false && value !== true) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        throw new TypeError('freezeTime must be false, true, a non-negative epoch or an ISO date');
      }
    } else if (typeof value === 'string') {
      if (Number.isNaN(Date.parse(value))) {
        throw new TypeError('freezeTime must be a valid ISO date string');
      }
    } else {
      throw new TypeError('freezeTime must be false, true, a non-negative epoch or an ISO date');
    }
  }
  if (config.timezone !== null && !validTimezone(config.timezone)) {
    throw new TypeError('timezone must be a valid IANA timezone');
  }
  if (config.randomSeed !== null) {
    if (
      !Number.isInteger(config.randomSeed) ||
      config.randomSeed < 0 ||
      config.randomSeed > 0xffffffff
    ) {
      throw new TypeError('randomSeed must be null or an integer between 0 and 4294967295');
    }
  }
}

/**
 * Validates the global hydration policy lists.
 * @param {object} config
 */
export function validateHydrationConfig(config) {
  if (!isPlainObject(config.hydration)) {
    throw new TypeError('hydration must be an object');
  }
  validPatternList(config.hydration.allowRerender ?? [], 'hydration.allowRerender');
  validPatternList(config.hydration.skip ?? [], 'hydration.skip');
}

// Validates the locale matrix and the path/single mode invariants.
export function validateLocales(config) {
  const locales = config.locales;
  if (locales === null) return;
  if (!isPlainObject(locales)) throw new TypeError('locales must be null or an options object');
  for (const key of Object.keys(locales)) {
    if (!['mode', 'default', 'xDefault', 'hreflang', 'list', 'active'].includes(key)) {
      throw new TypeError(`locales.${key} is not a recognised option`);
    }
  }
  if (!['path', 'single'].includes(locales.mode)) {
    throw new TypeError("locales.mode must be 'path' or 'single'");
  }
  if (locales.hreflang !== undefined && typeof locales.hreflang !== 'boolean') {
    throw new TypeError('locales.hreflang must be a boolean');
  }
  if (!Array.isArray(locales.list) || locales.list.length === 0) {
    throw new TypeError('locales.list must be a non-empty array');
  }
  const codes = new Set();
  const prefixes = new Set();
  for (const locale of locales.list) {
    if (!isPlainObject(locale)) throw new TypeError('locales.list entries must be objects');
    for (const key of Object.keys(locale)) {
      if (
        ![
          'code',
          'prefix',
          'url',
          'htmlLang',
          'dir',
          'ogLocale',
          'locale',
          'timezone',
          'routes',
          'storageState',
          'cookies',
          'localStorage',
        ].includes(key)
      ) {
        throw new TypeError(`locales.list.${key} is not a recognised option`);
      }
    }
    if (!validLocaleCode(locale.code)) {
      throw new TypeError(`locales.list.code must be a valid language tag: ${locale.code}`);
    }
    if (codes.has(locale.code)) throw new TypeError(`duplicate locale code: ${locale.code}`);
    codes.add(locale.code);
    if (locales.mode === 'path' && locale.prefix !== undefined) {
      if (
        typeof locale.prefix !== 'string' ||
        (locale.prefix !== '' && !locale.prefix.startsWith('/'))
      ) {
        throw new TypeError('locales.list.prefix must be an empty string or start with /');
      }
      if (locale.prefix.endsWith('/') && locale.prefix !== '/') {
        throw new TypeError('locales.list.prefix must not end with /');
      }
      if (locale.prefix.includes('..')) throw new TypeError('locales.list.prefix must be safe');
      if (prefixes.has(locale.prefix)) {
        throw new TypeError(`duplicate locale prefix: ${locale.prefix}`);
      }
      prefixes.add(locale.prefix);
    }
    if (locale.url !== undefined && locale.url !== null) {
      if (typeof locale.url !== 'string' || !/^https?:\/\//.test(locale.url)) {
        throw new TypeError('locales.list.url must be an absolute http(s) URL');
      }
      const parsed = new URL(locale.url);
      if (parsed.pathname !== '/' && parsed.pathname !== '') {
        throw new TypeError('locales.list.url must be an origin without a path');
      }
    }
    for (const key of ['htmlLang', 'dir', 'ogLocale', 'locale', 'timezone']) {
      const value = locale[key];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new TypeError(`locales.list.${key} must be a string or null`);
      }
    }
    if (locale.dir && !['ltr', 'rtl', 'auto'].includes(locale.dir)) {
      throw new TypeError("locales.list.dir must be 'ltr', 'rtl' or 'auto'");
    }
    if (locale.timezone && !validTimezone(locale.timezone)) {
      throw new TypeError('locales.list.timezone must be a valid IANA timezone');
    }
    if (locale.routes !== undefined) {
      if (!isPlainObject(locale.routes)) {
        throw new TypeError('locales.list.routes must be an object');
      }
      for (const [from, to] of Object.entries(locale.routes)) {
        if (
          typeof from !== 'string' ||
          !from.startsWith('/') ||
          typeof to !== 'string' ||
          !to.startsWith('/') ||
          from.includes('..') ||
          to.includes('..')
        ) {
          throw new TypeError('locales.list.routes must map safe /paths to safe /paths');
        }
      }
    }
    if (locale.storageState !== undefined && locale.storageState !== null) {
      if (typeof locale.storageState !== 'string' || !fs.existsSync(locale.storageState)) {
        throw new TypeError(
          'locales.list.storageState must point to an existing Playwright storage state file',
        );
      }
    }
    validateLocaleCookies(locale.cookies, 'locales.list.cookies');
    if (locale.localStorage !== undefined) {
      if (!isPlainObject(locale.localStorage)) {
        throw new TypeError('locales.list.localStorage must be an object');
      }
      for (const value of Object.values(locale.localStorage)) {
        if (typeof value !== 'string') {
          throw new TypeError('locales.list.localStorage values must be strings');
        }
      }
    }
  }
  if (locales.default !== undefined && !codes.has(locales.default)) {
    throw new TypeError('locales.default must name a locale in locales.list');
  }
  if (locales.active !== undefined && !codes.has(locales.active)) {
    throw new TypeError('locales.active must name a locale in locales.list');
  }
  if (locales.default === undefined && locales.list.length > 1) {
    throw new TypeError('locales.default is required when multiple locales are configured');
  }
  if (locales.xDefault !== undefined && locales.xDefault !== false) {
    if (typeof locales.xDefault !== 'string') {
      throw new TypeError('locales.xDefault must be false, a locale code or an absolute URL');
    }
    if (!codes.has(locales.xDefault) && !/^https?:\/\//.test(locales.xDefault)) {
      throw new TypeError('locales.xDefault must name a locale or be an absolute URL');
    }
  }
  if (locales.mode === 'single') {
    if (locales.active === undefined || !codes.has(locales.active)) {
      throw new TypeError('locales.active is required in single mode and must name a locale');
    }
    if (locales.list.length > 1 && locales.hreflang !== false) {
      for (const locale of locales.list) {
        if (!locale.url && !config.metadata?.siteUrl) {
          throw new TypeError(
            'single-mode hreflang needs locales.list.url or metadata.siteUrl for every locale',
          );
        }
      }
    }
  }
  if (locales.mode === 'path' && locales.hreflang !== false) {
    if (!config.metadata?.siteUrl && locales.list.some((locale) => !locale.url)) {
      throw new TypeError('path-mode hreflang needs metadata.siteUrl or a url for every locale');
    }
  }
  if (locales.mode === 'path') {
    const origins = new Set(
      locales.list
        .map((locale) => (typeof locale.url === 'string' ? new URL(locale.url).origin : null))
        .filter(Boolean),
    );
    if (origins.size > 1) {
      throw new TypeError(
        'path mode uses one public origin; use single mode for separate locale domains',
      );
    }
    if (config.metadata?.siteUrl && origins.size === 1) {
      const configured = [...origins][0];
      if (configured !== new URL(config.metadata.siteUrl).origin) {
        throw new TypeError(
          'path mode locale urls must match metadata.siteUrl; use single mode for separate domains',
        );
      }
    }
  }
}

/**
 * Validates locale cookie records used by the render and verification contexts.
 * @param {unknown} cookies
 * @param {string} name
 */
function validateLocaleCookies(cookies, name) {
  if (cookies === undefined) return;
  if (!Array.isArray(cookies)) throw new TypeError(`${name} must be an array`);
  for (const cookie of cookies) {
    if (!isPlainObject(cookie)) throw new TypeError(`${name} entries must be objects`);
    if (typeof cookie.name !== 'string' || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(cookie.name)) {
      throw new TypeError(`${name}.name must be a valid cookie name`);
    }
    if (typeof cookie.value !== 'string') {
      throw new TypeError(`${name}.value must be a string`);
    }
    if (
      cookie.path !== undefined &&
      (typeof cookie.path !== 'string' || !cookie.path.startsWith('/'))
    ) {
      throw new TypeError(`${name}.path must start with /`);
    }
    if (
      cookie.domain !== undefined &&
      cookie.domain !== null &&
      typeof cookie.domain !== 'string'
    ) {
      throw new TypeError(`${name}.domain must be a string or null`);
    }
    if (
      cookie.sameSite !== undefined &&
      !['Strict', 'Lax', 'None', 'strict', 'lax', 'none'].includes(cookie.sameSite)
    ) {
      throw new TypeError(`${name}.sameSite must be Strict, Lax or None`);
    }
    if (cookie.secure !== undefined && typeof cookie.secure !== 'boolean') {
      throw new TypeError(`${name}.secure must be a boolean`);
    }
    if (cookie.httpOnly !== undefined && typeof cookie.httpOnly !== 'boolean') {
      throw new TypeError(`${name}.httpOnly must be a boolean`);
    }
    if (
      cookie.maxAge !== undefined &&
      cookie.maxAge !== null &&
      (!Number.isInteger(cookie.maxAge) || cookie.maxAge < 0)
    ) {
      throw new TypeError(`${name}.maxAge must be a non-negative integer`);
    }
  }
}

// Validates the optional cookie/localStorage SEO locale recipe.
export function validateSeoLocale(config) {
  const seo = config.seoLocale;
  if (seo === null) return;
  if (!isPlainObject(seo)) throw new TypeError('seoLocale must be null or an options object');
  for (const key of Object.keys(seo)) {
    if (
      ![
        'code',
        'source',
        'value',
        'localStorageKey',
        'cookie',
        'seedRender',
        'seedVerification',
        'inject',
        'overwrite',
        'navigator',
        'htmlLang',
        'forceHtmlLang',
        'dir',
        'routes',
      ].includes(key)
    ) {
      throw new TypeError(`seoLocale.${key} is not a recognised option`);
    }
  }
  const singleActive = config.locales?.mode === 'single' ? config.locales.active : null;
  const pathMode = config.locales?.mode === 'path';
  if (seo.code === undefined && !singleActive && !pathMode) {
    throw new TypeError('seoLocale.code is required unless locales.active is set');
  }
  if (seo.code !== undefined) {
    if (!validLocaleCode(seo.code)) {
      throw new TypeError(`seoLocale.code must be a valid language tag: ${seo.code}`);
    }
    if (singleActive && seo.code !== singleActive) {
      throw new TypeError('seoLocale.code must match locales.active in single mode');
    }
  }
  if (!['localStorage', 'cookie', 'both'].includes(seo.source ?? 'both')) {
    throw new TypeError("seoLocale.source must be 'localStorage', 'cookie' or 'both'");
  }
  if (seo.value !== undefined && seo.value !== null && typeof seo.value !== 'string') {
    throw new TypeError('seoLocale.value must be a string or null');
  }
  if (
    seo.localStorageKey !== undefined &&
    (typeof seo.localStorageKey !== 'string' || seo.localStorageKey.length === 0)
  ) {
    throw new TypeError('seoLocale.localStorageKey must be a non-empty string');
  }
  if (seo.cookie !== undefined) {
    if (!isPlainObject(seo.cookie)) throw new TypeError('seoLocale.cookie must be an object');
    const cookie = seo.cookie;
    if (cookie.name !== undefined && typeof cookie.name !== 'string') {
      throw new TypeError('seoLocale.cookie.name must be a string');
    }
    if (cookie.name !== undefined && !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(cookie.name)) {
      throw new TypeError('seoLocale.cookie.name must be a valid cookie name');
    }
    if (
      cookie.path !== undefined &&
      (typeof cookie.path !== 'string' || !cookie.path.startsWith('/'))
    ) {
      throw new TypeError('seoLocale.cookie.path must start with /');
    }
    if (cookie.path !== undefined && /[;,\s]/.test(cookie.path)) {
      throw new TypeError('seoLocale.cookie.path contains invalid characters');
    }
    if (
      cookie.domain !== undefined &&
      cookie.domain !== null &&
      typeof cookie.domain !== 'string'
    ) {
      throw new TypeError('seoLocale.cookie.domain must be a string or null');
    }
    if (cookie.domain && /[;,\s/]/.test(cookie.domain)) {
      throw new TypeError('seoLocale.cookie.domain contains invalid characters');
    }
    if (
      cookie.sameSite !== undefined &&
      !['Strict', 'Lax', 'None', 'strict', 'lax', 'none'].includes(cookie.sameSite)
    ) {
      throw new TypeError('seoLocale.cookie.sameSite must be Strict, Lax or None');
    }
    if (cookie.secure !== undefined && typeof cookie.secure !== 'boolean') {
      throw new TypeError('seoLocale.cookie.secure must be a boolean');
    }
    if (
      cookie.maxAge !== undefined &&
      cookie.maxAge !== null &&
      (!Number.isInteger(cookie.maxAge) || cookie.maxAge < 0)
    ) {
      throw new TypeError('seoLocale.cookie.maxAge must be a non-negative integer');
    }
  }
  for (const key of [
    'seedRender',
    'seedVerification',
    'inject',
    'overwrite',
    'navigator',
    'forceHtmlLang',
  ]) {
    if (seo[key] !== undefined && typeof seo[key] !== 'boolean') {
      throw new TypeError(`seoLocale.${key} must be a boolean`);
    }
  }
  if (
    seo.htmlLang !== undefined &&
    typeof seo.htmlLang !== 'boolean' &&
    typeof seo.htmlLang !== 'string'
  ) {
    throw new TypeError('seoLocale.htmlLang must be a boolean or a string');
  }
  if (seo.dir !== undefined && seo.dir !== null && !['ltr', 'rtl', 'auto'].includes(seo.dir)) {
    throw new TypeError("seoLocale.dir must be 'ltr', 'rtl' or 'auto'");
  }
  if (seo.routes !== undefined) validPatternList(seo.routes, 'seoLocale.routes');
  if ((seo.inject ?? true) && config.removeScriptTags) {
    throw new TypeError(
      'seoLocale.inject cannot be combined with removeScriptTags: the bootstrap script would be stripped',
    );
  }
}

// The metadata keys the head component reads, so a typo is reported instead of ignored.
const METADATA_KEYS = new Set([
  'siteUrl',
  'siteName',
  'titleTemplate',
  'defaultTitle',
  'defaultImage',
  'trailingSlash',
  'base',
]);

/**
 * Validates the defaults handed to the head component, so a typo surfaces at config time
 * rather than as metadata that silently points at the build server.
 */
export function validateMetadata(config) {
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
