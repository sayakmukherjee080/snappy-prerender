import { toPublicPath } from '../routes.js';
import { pagePath } from '../url-policy.js';

/**
 * Checks the metadata a crawler reads on every written page: titles, descriptions,
 * canonicals, headings, build-origin leakage and duplicate values across routes.
 */
export function auditMetadata({ pages, config, add }) {
  const titles = new Map();
  const descriptions = new Map();
  for (const page of pages) {
    const meta = page.meta ?? {};
    if (!meta.title) {
      add('warning', 'missing-title', `no <title> on ${page.route}`, { route: page.route });
    }
    if (!meta.description) {
      add('warning', 'missing-description', `no meta description on ${page.route}`, {
        route: page.route,
      });
    }
    if (!meta.canonical) {
      add('warning', 'missing-canonical', `no canonical link on ${page.route}`, {
        route: page.route,
      });
    }
    if (meta.titleCount > 1) {
      add('error', 'multiple-titles', `${page.route} contains more than one <title>`, {
        route: page.route,
      });
    }
    if (meta.h1Count !== 1) {
      add('warning', 'heading-count', `${page.route} has ${meta.h1Count} <h1> element(s)`, {
        route: page.route,
      });
    }
    if ((page.buildOriginUrls ?? []).length > 0) {
      add(
        'warning',
        'build-origin-metadata',
        `${page.route} still points at the build server: ${page.buildOriginUrls.join(', ')}`,
        { route: page.route },
      );
    }
    if (meta.title) titles.set(meta.title, [...(titles.get(meta.title) ?? []), page.route]);
    if (meta.description) {
      descriptions.set(meta.description, [
        ...(descriptions.get(meta.description) ?? []),
        page.route,
      ]);
    }
    if (config.metadata?.siteUrl && meta.canonical) {
      const expected = expectedPageUrl(page.route, config, page.locale);
      if (expected && meta.canonical !== expected) {
        add(
          'warning',
          'canonical-mismatch',
          `${page.route} canonical is ${meta.canonical}, expected ${expected}`,
          { route: page.route },
        );
      }
    }
  }
  auditHreflang({ pages, config, add });
  for (const [title, routes] of titles) {
    if (routes.length < 2) continue;
    add('error', 'duplicate-title', `routes share the title "${title}": ${routes.join(', ')}`, {
      routes,
    });
  }
  for (const [description, routes] of descriptions) {
    if (routes.length < 2) continue;
    add(
      'warning',
      'duplicate-description',
      `routes share the meta description "${description}": ${routes.join(', ')}`,
      { routes },
    );
  }
}

/**
 * Checks generated and app-owned hreflang links for validity, self-reference, x-default
 * and reciprocal links inside the run.
 * @param {{ pages: Array<object>, config: object, add: Function }} input
 */
function auditHreflang({ pages, config, add }) {
  if (!config.locales) return;
  const byUrl = new Map();
  for (const page of pages) {
    if (page.noindex || page.notFound) continue;
    const url = expectedPageUrl(page.route, config, page.locale) ?? page.meta?.canonical;
    if (url) byUrl.set(url, page);
  }
  for (const page of pages) {
    if (page.noindex || page.notFound) continue;
    const meta = page.meta ?? {};
    const code = page.locale ?? config.locales.active ?? config.locales.default;
    const locale = config.locales.list.find((entry) => entry.code === code) ?? null;
    const expectedLang = locale?.htmlLang ?? code;
    if (!meta.lang) {
      add('warning', 'html-lang-missing', `${page.route} has no <html lang>`, {
        route: page.route,
      });
    } else if (meta.lang !== expectedLang && meta.lang !== code) {
      add(
        'warning',
        'html-lang-mismatch',
        `${page.route} has <html lang="${meta.lang}">, expected "${expectedLang}"`,
        { route: page.route },
      );
    }
    if (locale?.ogLocale && !meta.ogLocale) {
      add('warning', 'og-locale-missing', `${page.route} has no og:locale for ${code}`, {
        route: page.route,
      });
    }
    if (config.locales.hreflang === false) continue;
    const alternates = meta.alternates ?? [];
    const seen = new Set();
    for (const alternate of alternates) {
      const value = String(alternate.hreflang);
      if (value !== 'x-default' && !validHreflang(value)) {
        add('error', 'hreflang-invalid', `${page.route} has invalid hreflang "${value}"`, {
          route: page.route,
        });
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        add('error', 'hreflang-duplicate', `${page.route} repeats hreflang "${value}"`, {
          route: page.route,
        });
      }
      seen.add(key);
    }
    const selfUrl = meta.canonical ?? expectedPageUrl(page.route, config, page.locale);
    const self = alternates.find((alternate) => alternate.hreflang === code);
    if (!self) {
      add('warning', 'hreflang-missing-self', `${page.route} has no self hreflang "${code}"`, {
        route: page.route,
      });
    } else if (selfUrl && self.href !== selfUrl) {
      add(
        'warning',
        'hreflang-canonical-mismatch',
        `${page.route} hreflang "${code}" points at ${self.href}, expected ${selfUrl}`,
        { route: page.route },
      );
    }
    if (!seen.has('x-default') && config.locales.xDefault !== false) {
      add('warning', 'hreflang-missing-x-default', `${page.route} has no x-default hreflang`, {
        route: page.route,
      });
    }
    for (const alternate of alternates) {
      const target = byUrl.get(alternate.href);
      if (!target) continue;
      const targetSelf = target.meta?.alternates?.some(
        (entry) => entry.hreflang === code && entry.href === selfUrl,
      );
      if (!targetSelf) {
        add(
          'error',
          'hreflang-missing-return',
          `${page.route} links to ${target.route} for ${alternate.hreflang}, but ${target.route} does not link back`,
          { route: page.route, to: target.route },
        );
      }
    }
  }
}

/**
 * Reports whether a value is a valid hreflang language tag.
 * @param {string} code
 * @returns {boolean}
 */
function validHreflang(code) {
  try {
    return Intl.getCanonicalLocales(code).length === 1;
  } catch {
    return false;
  }
}

// Resolves the public URL a page should canonicalise and be listed at.
export function expectedPageUrl(route, config, localeCode = null) {
  const locale = localeCode
    ? config.locales?.list?.find((entry) => entry.code === localeCode)
    : null;
  const baseUrl = locale?.url ?? config.metadata?.siteUrl;
  if (!baseUrl) return null;
  const path = pagePath(route, {
    flatOutput: config.flatOutput,
    trailingSlash: config.metadata.trailingSlash,
  });
  return `${baseUrl.replace(/\/$/, '')}${toPublicPath(path, config.base)}`;
}
