import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse, serialize } from 'parse5';
import {
  activeLocale,
  applyLocaleMetadata,
  buildLocaleLinks,
  buildLocalePlan,
  isLocalePrefixedRoute,
  localeRoute,
  stripLocalePrefix,
} from '../../src/core/locales.js';

const pathConfig = {
  base: '/',
  flatOutput: false,
  metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
  locales: {
    mode: 'path',
    default: 'en',
    xDefault: 'en',
    hreflang: true,
    list: [
      { code: 'en', prefix: '', htmlLang: 'en', ogLocale: 'en_US' },
      {
        code: 'fr',
        prefix: '/fr',
        htmlLang: 'fr',
        ogLocale: 'fr_FR',
        routes: { '/about': '/a-propos' },
      },
    ],
  },
};

function documentOf(
  html = '<!doctype html><html><head><title>Page</title></head><body></body></html>',
) {
  return parse(html);
}

describe('locale plan helpers', () => {
  it('builds a synthetic single-locale plan from seoLocale', () => {
    const plan = buildLocalePlan({
      seoLocale: { code: 'fr', htmlLang: 'fr-FR', dir: 'ltr' },
    });
    assert.equal(plan.mode, 'single');
    assert.equal(plan.active, 'fr');
    assert.equal(plan.list[0].htmlLang, 'fr-FR');
    assert.equal(activeLocale(plan).code, 'fr');
  });

  it('maps base routes through prefixes and translated paths', () => {
    const [en, fr] = pathConfig.locales.list;
    assert.equal(localeRoute(en, '/about'), '/about');
    assert.equal(localeRoute(fr, '/about'), '/fr/a-propos');
    assert.equal(localeRoute(fr, '/'), '/fr');
    assert.equal(stripLocalePrefix('/fr/a-propos', fr), '/a-propos');
    assert.equal(stripLocalePrefix('/fr', fr), '/');
  });

  it('recognises non-default locale routes', () => {
    assert.equal(isLocalePrefixedRoute('/fr/about', pathConfig.locales), true);
    assert.equal(isLocalePrefixedRoute('/about', pathConfig.locales), false);
    assert.equal(
      isLocalePrefixedRoute('/fr/about', { ...pathConfig.locales, mode: 'single' }),
      false,
    );
  });
});

describe('buildLocaleLinks', () => {
  it('builds canonical, alternate and Open Graph locale values', () => {
    const links = buildLocaleLinks({
      locale: pathConfig.locales.list[1],
      baseRoute: '/about',
      plan: pathConfig.locales,
      config: pathConfig,
    });
    assert.equal(links.htmlLang, 'fr');
    assert.equal(links.canonical, 'https://example.com/fr/a-propos/');
    assert.equal(links.ogLocale, 'fr_FR');
    assert.deepEqual(links.ogAlternates, ['en_US']);
    assert.deepEqual(links.alternates, [
      { hreflang: 'en', href: 'https://example.com/about/' },
      { hreflang: 'fr', href: 'https://example.com/fr/a-propos/' },
      { hreflang: 'x-default', href: 'https://example.com/about/' },
    ]);
  });

  it('uses per-locale deployment origins in single mode', () => {
    const plan = {
      mode: 'single',
      active: 'fr',
      default: 'en',
      xDefault: 'en',
      hreflang: true,
      list: [
        { code: 'en', prefix: '', url: 'https://example.com', htmlLang: 'en' },
        { code: 'fr', prefix: '', url: 'https://fr.example.com', htmlLang: 'fr' },
      ],
    };
    const links = buildLocaleLinks({
      locale: plan.list[1],
      baseRoute: '/',
      plan,
      config: { ...pathConfig, locales: plan },
    });
    assert.equal(links.canonical, 'https://fr.example.com/');
    assert.deepEqual(links.alternates, [
      { hreflang: 'en', href: 'https://example.com/' },
      { hreflang: 'fr', href: 'https://fr.example.com/' },
      { hreflang: 'x-default', href: 'https://example.com/' },
    ]);
  });
});

describe('applyLocaleMetadata', () => {
  it('writes language, canonical, hreflang and Open Graph tags', () => {
    const document = documentOf();
    const links = buildLocaleLinks({
      locale: pathConfig.locales.list[1],
      baseRoute: '/about',
      plan: pathConfig.locales,
      config: pathConfig,
    });
    applyLocaleMetadata(document, links);
    const html = serialize(document);
    assert.match(html, /<html lang="fr"/);
    assert.match(html, /rel="canonical" href="https:\/\/example.com\/fr\/a-propos\/"/);
    assert.match(html, /hreflang="en" href="https:\/\/example.com\/about\/"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/example.com\/about\/"/);
    assert.match(html, /property="og:locale" content="fr_FR"/);
    assert.match(html, /property="og:locale:alternate" content="en_US"/);
  });

  it('is idempotent and leaves app-owned metadata alone', () => {
    const document = documentOf(
      '<!doctype html><html lang="de"><head><link rel="canonical" href="https://app.example/page"></head><body></body></html>',
    );
    const links = buildLocaleLinks({
      locale: pathConfig.locales.list[1],
      baseRoute: '/about',
      plan: pathConfig.locales,
      config: pathConfig,
    });
    applyLocaleMetadata(document, links);
    applyLocaleMetadata(document, links);
    const html = serialize(document);
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
    assert.match(html, /rel="canonical" href="https:\/\/app.example\/page"/);
    assert.match(html, /<html lang="de">/);
    assert.equal((html.match(/hreflang="fr"/g) ?? []).length, 1);
  });

  it('skips alternates on noindex pages', () => {
    const document = documentOf(
      '<!doctype html><html><head><meta name="robots" content="noindex"></head><body></body></html>',
    );
    const links = buildLocaleLinks({
      locale: pathConfig.locales.list[1],
      baseRoute: '/about',
      plan: pathConfig.locales,
      config: pathConfig,
    });
    applyLocaleMetadata(document, links, { skipAlternates: true });
    const html = serialize(document);
    assert.equal(html.includes('hreflang='), false);
    assert.match(html, /<html lang="fr"/);
  });

  it('forces an app-owned language when requested', () => {
    const document = documentOf('<!doctype html><html lang="en"><head></head><body></body></html>');
    const links = buildLocaleLinks({
      locale: pathConfig.locales.list[1],
      baseRoute: '/about',
      plan: pathConfig.locales,
      config: pathConfig,
    });
    applyLocaleMetadata(document, links, { forceHtmlLang: true });
    assert.match(serialize(document), /<html lang="fr"/);
  });
});
