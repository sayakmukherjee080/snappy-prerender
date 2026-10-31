import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse, serialize } from 'parse5';
import {
  buildSeoLocaleScript,
  injectSeoLocaleScript,
  resolveSeoLocale,
} from '../../src/core/seo-locale.js';

const seo = {
  code: 'fr',
  value: 'fr',
  source: 'both',
  localStorageKey: 'locale',
  overwrite: true,
  cookie: {
    name: 'locale',
    path: '/',
    domain: null,
    sameSite: 'Lax',
    secure: false,
    maxAge: 3600,
  },
  routes: ['/*'],
  htmlLang: true,
  forceHtmlLang: false,
  dir: null,
};

describe('resolveSeoLocale', () => {
  it('uses the route locale in path mode', () => {
    const resolved = resolveSeoLocale(
      { seoLocale: seo, locales: { mode: 'path', active: null } },
      { code: 'de' },
      '/de/about',
    );
    assert.equal(resolved.code, 'de');
  });

  it('uses the active locale in single mode', () => {
    const resolved = resolveSeoLocale(
      { seoLocale: seo, locales: { mode: 'single', active: 'fr' } },
      null,
      '/',
    );
    assert.equal(resolved.code, 'fr');
  });

  it('honours route patterns', () => {
    const resolved = resolveSeoLocale({ seoLocale: { ...seo, routes: ['/fr/*'] } }, null, '/en');
    assert.equal(resolved, null);
  });
});

describe('buildSeoLocaleScript', () => {
  it('writes local storage and a cookie with escaped values', () => {
    const script = buildSeoLocaleScript({
      ...seo,
      value: 'fr"fr',
      cookie: { ...seo.cookie, name: 'app_locale', maxAge: 3600 },
    });
    assert.match(script, /window\.localStorage\.setItem\("locale", "fr\\"fr"\)/);
    assert.match(script, /encodeURIComponent\("fr\\"fr"\)/);
    assert.match(script, /max-age=3600/);
    assert.match(script, /SameSite=Lax/);
    assert.equal(script.includes('document.cookie = "app_locale"'), true);
  });

  it('only sets a missing value when overwrite is false', () => {
    const script = buildSeoLocaleScript({ ...seo, overwrite: false });
    assert.match(script, /window\.localStorage\.getItem\("locale"\) === null/);
    assert.match(script, /if \(!has\)/);
  });

  it('emits only the configured source', () => {
    const local = buildSeoLocaleScript({ ...seo, source: 'localStorage' });
    assert.match(local, /localStorage\.setItem/);
    assert.equal(local.includes('document.cookie'), false);
    const cookie = buildSeoLocaleScript({ ...seo, source: 'cookie' });
    assert.equal(cookie.includes('localStorage'), false);
    assert.match(cookie, /document\.cookie/);
  });
});

describe('injectSeoLocaleScript', () => {
  it('inserts the bootstrap before the first head script', () => {
    const document = parse(
      '<!doctype html><html><head><script src="/app.js"></script></head><body></body></html>',
    );
    injectSeoLocaleScript(document, 'window.inline = true;');
    const html = serialize(document);
    assert.ok(html.indexOf('window.inline = true;') < html.indexOf('/app.js'));
    assert.match(html, /data-snappy-seo-locale/);
  });

  it('replaces a previous generated bootstrap and supports an external script', () => {
    const document = parse(
      '<!doctype html><html><head><script data-snappy-seo-locale="">old</script><script src="/app.js"></script></head><body></body></html>',
    );
    injectSeoLocaleScript(document, 'new', '/snappy-seo-locale-abc.js');
    const html = serialize(document);
    assert.equal(html.includes('>old<'), false);
    assert.match(html, /src="\/snappy-seo-locale-abc\.js"/);
    assert.equal((html.match(/data-snappy-seo-locale/g) ?? []).length, 1);
  });
});
