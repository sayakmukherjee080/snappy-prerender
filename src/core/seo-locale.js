import { matchesPattern } from './routes.js';

/**
 * Resolves the SEO locale recipe for one route. The code comes from the route locale in
 * path mode, from the active locale in single mode, or from seoLocale.code standalone.
 * @param {object} config
 * @param {object | null} locale
 * @param {string} route
 * @returns {object | null}
 */
export function resolveSeoLocale(config, locale, route) {
  const seo = config.seoLocale;
  if (!seo) return null;
  if (!(seo.routes ?? []).some((pattern) => matchesPattern(route, pattern))) return null;
  const code =
    config.locales?.mode === 'path'
      ? locale?.code
      : (config.locales?.active ?? seo.code ?? locale?.code);
  if (!code) return null;
  return { ...seo, code, value: seo.value ?? code };
}

/**
 * Seeds local storage before the app bundle runs. The init script runs on the page's
 * origin, which is what makes it work with the ephemeral prerender server.
 * @param {import('playwright-core').Page} page
 * @param {object} seo
 */
export async function seedPageStorage(page, seo) {
  if (seo.source !== 'localStorage' && seo.source !== 'both') return;
  await seedLocalStorage(page, { [seo.localStorageKey]: seo.value }, seo.overwrite);
}

/**
 * Seeds a fixed set of local storage entries before the app boots.
 * @param {import('playwright-core').Page} page
 * @param {Record<string, string>} entries
 * @param {boolean} overwrite
 */
export async function seedLocalStorage(page, entries, overwrite = true) {
  if (!entries || Object.keys(entries).length === 0) return;
  await page.addInitScript(
    ({ values, replace }) => {
      try {
        for (const [key, value] of Object.entries(values)) {
          if (replace || window.localStorage.getItem(key) === null) {
            window.localStorage.setItem(key, value);
          }
        }
      } catch {
        // Local storage can be unavailable in private contexts; the app still renders its default.
      }
    },
    { values: entries, replace: overwrite },
  );
}

/**
 * Seeds the locale cookie in the browser context, using the current origin when no
 * explicit domain is configured.
 * @param {import('playwright-core').BrowserContext} context
 * @param {string} origin
 * @param {object} seo
 */
export async function seedContextCookie(context, origin, seo) {
  if (seo.source !== 'cookie' && seo.source !== 'both') return;
  if (!seo.overwrite) {
    const existing = await context.cookies();
    if (existing.some((cookie) => cookie.name === seo.cookie.name)) return;
  }
  await seedCookies(context, origin, [
    {
      ...seo.cookie,
      value: seo.value,
      httpOnly: false,
    },
  ]);
}

/**
 * Adds cookies with the same attributes to the render and verification contexts.
 * @param {import('playwright-core').BrowserContext} context
 * @param {string} origin
 * @param {Array<object>} cookies
 */
export async function seedCookies(context, origin, cookies = []) {
  if (!Array.isArray(cookies) || cookies.length === 0) return;
  const entries = cookies.map((cookie) => {
    const secure = cookie.secure === true && !origin.startsWith('http://');
    const sameSite = normaliseSameSite(cookie.sameSite);
    const entry = {
      name: cookie.name,
      value: String(cookie.value),
      httpOnly: cookie.httpOnly === true,
      secure,
      // Browsers reject SameSite=None without Secure; keep local HTTP previews usable.
      sameSite: sameSite === 'None' && !secure ? 'Lax' : sameSite,
      expires:
        cookie.maxAge !== null && cookie.maxAge !== undefined
          ? Math.floor(Date.now() / 1000) + cookie.maxAge
          : -1,
    };
    if (cookie.domain) {
      entry.domain = cookie.domain;
      entry.path = cookie.path ?? '/';
    } else {
      entry.url = origin;
    }
    return entry;
  });
  await context.addCookies(entries);
}

/**
 * Builds the small bootstrap script written into localized pages. Values are serialised as
 * strings and cookie values are percent-encoded; no configuration value is interpolated
 * as raw JavaScript.
 * @param {object} seo
 * @returns {string}
 */
export function buildSeoLocaleScript(seo) {
  const key = JSON.stringify(seo.localStorageKey);
  const value = JSON.stringify(seo.value);
  const cookieName = JSON.stringify(seo.cookie.name);
  const cookieAttributes =
    `; path=${seo.cookie.path ?? '/'}` +
    (seo.cookie.domain ? `; domain=${seo.cookie.domain}` : '') +
    (seo.cookie.maxAge !== null && seo.cookie.maxAge !== undefined
      ? `; max-age=${seo.cookie.maxAge}`
      : '') +
    `; SameSite=${normaliseSameSite(seo.cookie.sameSite)}` +
    (seo.cookie.secure ? '; Secure' : '');
  const cookieExpression = `${cookieName} + "=" + encodeURIComponent(${value}) + ${JSON.stringify(cookieAttributes)}`;
  const localCondition = seo.overwrite ? 'true' : `window.localStorage.getItem(${key}) === null`;
  const parts = ['(function () {'];
  if (seo.source === 'localStorage' || seo.source === 'both') {
    parts.push(
      '  try {',
      `    if (${localCondition}) {`,
      `      window.localStorage.setItem(${key}, ${value});`,
      '    }',
      '  } catch (error) {}',
    );
  }
  if (seo.source === 'cookie' || seo.source === 'both') {
    parts.push(
      '  try {',
      `    var name = ${cookieName};`,
      '    var has = document.cookie.split("; ").some(function (part) {',
      '      return part.split("=")[0] === name;',
      '    });',
      `    if (${seo.overwrite ? 'true' : '!has'}) {`,
      `      document.cookie = ${cookieExpression};`,
      '    }',
      '  } catch (error) {}',
    );
  }
  parts.push('})();');
  return parts.join('\n');
}

/**
 * Inserts the bootstrap before the first head script, or at the end of the head when the
 * document has no script. A generated marker makes reruns replace the same script.
 * @param {object} document parse5 document
 * @param {string} script
 * @param {string | null} externalHref
 */
export function injectSeoLocaleScript(document, script, externalHref = null) {
  const head = findHead(document);
  if (!head) return;
  head.childNodes = (head.childNodes ?? []).filter(
    (node) => !node.attrs?.some((entry) => entry.name === 'data-snappy-seo-locale'),
  );
  const node = externalHref
    ? {
        nodeName: 'script',
        tagName: 'script',
        attrs: [
          { name: 'src', value: externalHref },
          { name: 'data-snappy-seo-locale', value: '' },
        ],
        namespaceURI: 'http://www.w3.org/1999/xhtml',
        childNodes: [],
        parentNode: null,
      }
    : {
        nodeName: 'script',
        tagName: 'script',
        attrs: [{ name: 'data-snappy-seo-locale', value: '' }],
        namespaceURI: 'http://www.w3.org/1999/xhtml',
        childNodes: [{ nodeName: '#text', value: script, parentNode: null }],
        parentNode: null,
      };
  const scriptIndex = (head.childNodes ?? []).findIndex((child) => child.tagName === 'script');
  if (scriptIndex === -1) head.childNodes.push(node);
  else head.childNodes.splice(scriptIndex, 0, node);
}

/**
 * Returns the current head language and direction controls for metadata injection.
 * @param {object | null} seo
 * @returns {{ htmlLang: string | boolean, dir: string | null, forceHtmlLang: boolean }}
 */
export function seoLocaleMetadataOptions(seo) {
  if (!seo) return { htmlLang: true, dir: null, forceHtmlLang: false };
  return {
    htmlLang: seo.htmlLang,
    dir: seo.dir,
    forceHtmlLang: seo.forceHtmlLang === true,
  };
}

/**
 * Normalises a cookie SameSite value to the form Playwright and document.cookie expect.
 * @param {string | undefined} value
 * @returns {'Strict' | 'Lax' | 'None'}
 */
function normaliseSameSite(value) {
  const text = String(value ?? 'Lax').toLowerCase();
  if (text === 'strict') return 'Strict';
  if (text === 'none') return 'None';
  return 'Lax';
}

/**
 * Finds the document head in a parsed document.
 * @param {object} document
 * @returns {object | null}
 */
function findHead(document) {
  const html = (document.childNodes ?? []).find((node) => node.tagName === 'html');
  return (html?.childNodes ?? []).find((node) => node.tagName === 'head') ?? null;
}
