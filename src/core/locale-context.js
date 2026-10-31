import {
  resolveSeoLocale,
  seedContextCookie,
  seedCookies,
  seedLocalStorage,
  seedPageStorage,
} from './seo-locale.js';

/**
 * Builds the Playwright context options that make one locale deterministic: browser
 * locale, timezone and the base storage state. The caller keeps auth storage separate from
 * locale cookies and local storage.
 * @param {object} config
 * @param {object | null} locale
 * @returns {{ locale?: string, timezoneId?: string }}
 */
export function localeContextOptions(config, locale) {
  const options = {};
  const browserLocale = locale?.locale ?? null;
  if (browserLocale) options.locale = browserLocale;
  const timezone = locale?.timezone ?? config.timezone ?? null;
  if (timezone) options.timezoneId = timezone;
  return options;
}

/**
 * Returns the storage state a locale should use, preferring its own file over the global
 * authenticated state.
 * @param {object} config
 * @param {object | null} locale
 * @returns {string | undefined}
 */
export function localeStorageState(config, locale) {
  return locale?.storageState ?? config.storageState ?? undefined;
}

/**
 * Seeds the extra cookies and local storage declared on a locale record. These are
 * independent of the SEO locale recipe and let a locale carry app-specific keys.
 * @param {{ page: import('playwright-core').Page, context: import('playwright-core').BrowserContext, origin: string, locale: object | null }} input
 */
export async function seedLocaleExtras({ page, context, origin, locale }) {
  if (!locale) return;
  await seedCookies(context, origin, locale.cookies ?? []);
  await seedLocalStorage(page, locale.localStorage ?? {}, true);
}

/**
 * Seeds the cookie and local storage the app reads before it boots. Render and verification
 * use the same recipe, so the selected locale is identical in both passes.
 * @param {{ page: import('playwright-core').Page, context: import('playwright-core').BrowserContext, origin: string, config: object, route: string, locale: object | null, phase: 'render' | 'verify' }} input
 * @returns {Promise<object | null>} the resolved SEO locale, when one applied
 */
export async function seedLocaleContext({ page, context, origin, config, route, locale, phase }) {
  await seedLocaleExtras({ page, context, origin, locale });
  const seo = resolveSeoLocale(config, locale, route);
  if (!seo) return null;
  if (phase === 'render' && !seo.seedRender) return null;
  if (phase === 'verify' && !seo.seedVerification) return null;
  await seedPageStorage(page, seo);
  await seedContextCookie(context, origin, seo);
  return seo;
}
