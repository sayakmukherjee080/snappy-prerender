import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite, runCli } from './support.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, '..', 'fixtures');
const base = {
  include: ['/'],
  crawl: false,
  audit: false,
  logLevel: 'silent',
  captureFormState: false,
  captureRuntimeStyles: false,
};

const singleLocale = {
  mode: 'single',
  active: 'fr',
  default: 'en',
  hreflang: true,
  list: [
    { code: 'en', url: 'https://example.com' },
    { code: 'fr', url: 'https://fr.example.com' },
  ],
};

const metadata = {
  siteUrl: 'https://fr.example.com',
  siteName: 'Example',
  trailingSlash: 'always',
};

after(cleanup);

describe('prerender integration: deterministic clock and SEO locale', () => {
  let sourceDir;

  before(async () => {
    const root = path.join(fixtureRoot, 'react19-locale-app');
    sourceDir = await makeStaticSite({});
    await build({ root, logLevel: 'silent', build: { outDir: sourceDir, emptyOutDir: true } });
  });

  async function run(options) {
    const destination = await makeStaticSite({});
    const report = await prerender({
      sourceDir,
      destination,
      cleanDestination: true,
      ...base,
      ...options,
    });
    return { report, destination };
  }

  it('hydrates a French localStorage build with a fixed clock', async () => {
    const { report, destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      timezone: 'UTC',
      locales: singleLocale,
      seoLocale: {
        code: 'fr',
        source: 'localStorage',
        inject: true,
        overwrite: true,
        forceHtmlLang: true,
      },
      metadata,
    });
    const entry = report.verification.routes.find((route) => route.route === '/');
    assert.equal(entry.mode, 'hydrated');
    assert.equal(report.verification.ok, true);
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.match(html, /<html lang="fr"/);
    assert.match(html, /Accueil/);
    assert.match(html, /2026-05-04T12:00:00.000Z/);
    assert.match(html, /hreflang="fr" href="https:\/\/fr.example.com\/"/);
    assert.match(html, /hreflang="en" href="https:\/\/example.com\/"/);
    assert.ok(
      html.indexOf('data-snappy-seo-locale') < html.indexOf('/assets/index-'),
      'locale bootstrap must run before the app bundle',
    );
  });

  it('re-renders without a fixed clock and allows it only when configured', async () => {
    const strict = await run({ metadata });
    const strictEntry = strict.report.verification.routes.find((route) => route.route === '/');
    assert.equal(strictEntry.mode, 're-rendered');
    assert.equal(strict.report.verification.allowed, 0);
    assert.ok(strictEntry.hydrationErrors.length > 0);

    const allowed = await run({ metadata, hydration: { allowRerender: ['/'] } });
    const allowedEntry = allowed.report.verification.routes.find((route) => route.route === '/');
    assert.equal(allowedEntry.mode, 're-rendered');
    assert.equal(allowedEntry.allowed, true);
    assert.deepEqual(allowedEntry.hydrationErrors, []);
    assert.ok(allowedEntry.ignoredHydrationErrors.length > 0);
    assert.equal(allowed.report.verification.ok, true);

    const skipped = await run({ metadata, hydration: { skip: ['/'] } });
    assert.equal(skipped.report.verification.routes.length, 0);
    assert.equal(skipped.report.verification.policySkipped, 1);
    assert.equal(skipped.report.routeDetails[0].hydrationPolicy, 'skip');
  });

  it('seeds a cookie locale and emits a cookie bootstrap', async () => {
    const { report, destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      locales: singleLocale,
      seoLocale: {
        code: 'fr',
        source: 'cookie',
        cookie: { name: 'locale' },
        inject: true,
        overwrite: true,
        forceHtmlLang: true,
      },
      metadata,
    });
    assert.equal(report.verification.routes.find((route) => route.route === '/').mode, 'hydrated');
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.match(html, /document\.cookie/);
    assert.equal(html.includes('localStorage.setItem'), false);
  });

  it('externalizes the bootstrap under a strict CSP', async () => {
    const { report, destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      csp: 'strict',
      locales: singleLocale,
      seoLocale: {
        code: 'fr',
        source: 'localStorage',
        inject: true,
        overwrite: true,
        forceHtmlLang: true,
      },
      metadata,
    });
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    const match = html.match(/<script src="([^"]*snappy-seo-locale-[^"]*\.js)"[^>]*>/);
    assert.ok(match, 'strict CSP should reference an external locale script');
    assert.equal(html.includes('window.localStorage.setItem'), false);
    const file = match[1].replace(/^\//, '');
    await fs.access(path.join(destination, file));
    assert.equal(report.seoLocale.script, file);
  });

  it('hashes the inline bootstrap under csp hash mode', async () => {
    const { destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      csp: 'hash',
      locales: singleLocale,
      seoLocale: {
        code: 'fr',
        source: 'localStorage',
        inject: true,
        overwrite: true,
        forceHtmlLang: true,
      },
      metadata,
    });
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    const script = html.match(/<script data-snappy-seo-locale="">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, 'hash mode should keep the bootstrap inline');
    const hash = `sha256-${createHash('sha256').update(script).digest('base64')}`;
    assert.match(html, /Content-Security-Policy/);
    assert.equal(html.includes(`'${hash}'`), true);
  });

  it('can localize the HTML without injecting a bootstrap', async () => {
    const { destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      locales: singleLocale,
      seoLocale: {
        code: 'fr',
        source: 'localStorage',
        inject: false,
        overwrite: true,
        forceHtmlLang: true,
      },
      metadata,
    });
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.match(html, /Accueil/);
    assert.equal(html.includes('data-snappy-seo-locale'), false);
  });

  it('preserves an existing storage value when overwrite is false', async () => {
    const existing = {
      ...singleLocale,
      list: singleLocale.list.map((locale) =>
        locale.code === 'fr' ? { ...locale, localStorage: { locale: 'en' } } : locale,
      ),
    };
    const { report, destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      locales: existing,
      seoLocale: {
        code: 'fr',
        source: 'localStorage',
        inject: true,
        overwrite: false,
        forceHtmlLang: true,
      },
      metadata,
    });
    assert.equal(report.verification.routes.find((route) => route.route === '/').mode, 'hydrated');
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.match(html, /Home/);
  });

  it('can use navigator.language without storage seeding', async () => {
    const { report, destination } = await run({
      freezeTime: '2026-05-04T12:00:00Z',
      randomSeed: 7,
      locales: singleLocale,
      seoLocale: {
        code: 'fr',
        source: 'localStorage',
        seedRender: false,
        seedVerification: false,
        inject: false,
        navigator: true,
        forceHtmlLang: true,
      },
      metadata,
    });
    assert.equal(report.verification.routes.find((route) => route.route === '/').mode, 'hydrated');
    const html = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    assert.match(html, /Accueil/);
  });
});

describe('prerender integration: path locales and hreflang', () => {
  it('renders localized routes with canonical and sitemap alternates', async () => {
    const source = await makeStaticSite({
      'index.html':
        '<!doctype html><html><head><title>Home</title><meta name="description" content="Home"></head><body><h1>Home</h1></body></html>',
      'about/index.html':
        '<!doctype html><html><head><title>About</title><meta name="description" content="About"></head><body><h1>About</h1></body></html>',
      'fr/index.html':
        '<!doctype html><html><head><title>Accueil</title><meta name="description" content="Accueil"></head><body><h1>Accueil</h1></body></html>',
      'fr/a-propos/index.html':
        '<!doctype html><html><head><title>À propos</title><meta name="description" content="À propos"></head><body><h1>À propos</h1></body></html>',
    });
    const destination = await makeStaticSite({});
    const report = await prerender({
      sourceDir: source,
      destination,
      cleanDestination: true,
      include: ['/', '/about'],
      crawl: false,
      verify: false,
      audit: true,
      sitemap: true,
      logLevel: 'silent',
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
      metadata: {
        siteUrl: 'https://example.com',
        siteName: 'Example',
        trailingSlash: 'always',
      },
    });
    assert.equal(report.ok, true);
    assert.equal(report.routes.length, 4);
    assert.deepEqual(report.audit.errors, []);
    const fr = await fs.readFile(path.join(destination, 'fr/a-propos/index.html'), 'utf8');
    assert.match(fr, /<html lang="fr"/);
    assert.match(fr, /rel="canonical" href="https:\/\/example.com\/fr\/a-propos\/"/);
    assert.match(fr, /hreflang="en" href="https:\/\/example.com\/about\/"/);
    assert.match(fr, /property="og:locale" content="fr_FR"/);
    const sitemap = await fs.readFile(path.join(destination, 'sitemap.xml'), 'utf8');
    assert.match(sitemap, /<loc>https:\/\/example.com\/fr\/a-propos\/<\/loc>/);
    assert.match(sitemap, /hreflang="x-default" href="https:\/\/example.com\/about\/"/);
  });

  it('seeds a different SEO locale for each path variant', async () => {
    const source = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Home</title><meta name="description" content="Home"></head><body><div id="root"></div><script>
        document.getElementById('root').textContent = (localStorage.getItem('locale') || 'en') === 'fr' ? 'Accueil' : 'Home';
      </script></body></html>`,
      'fr/index.html': `<!doctype html><html><head><title>Accueil</title><meta name="description" content="Accueil"></head><body><div id="root"></div><script>
        document.getElementById('root').textContent = (localStorage.getItem('locale') || 'en') === 'fr' ? 'Accueil' : 'Home';
      </script></body></html>`,
    });
    const destination = await makeStaticSite({});
    const report = await prerender({
      sourceDir: source,
      destination,
      cleanDestination: true,
      include: ['/'],
      crawl: false,
      verify: false,
      audit: false,
      logLevel: 'silent',
      locales: {
        mode: 'path',
        default: 'en',
        xDefault: 'en',
        list: [
          { code: 'en', prefix: '' },
          { code: 'fr', prefix: '/fr' },
        ],
      },
      seoLocale: { source: 'localStorage', inject: true, overwrite: true },
      metadata: { siteUrl: 'https://example.com', trailingSlash: 'always' },
    });
    assert.equal(report.ok, true);
    const en = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
    const fr = await fs.readFile(path.join(destination, 'fr/index.html'), 'utf8');
    assert.match(en, /Home/);
    assert.match(fr, /Accueil/);
    assert.match(en, /setItem\("locale", "en"\)/);
    assert.match(fr, /setItem\("locale", "fr"\)/);
  });
});

describe('prerender integration: locale CLI flags', () => {
  it('accepts clock and SEO locale flags', async () => {
    const source = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Home</title><meta name="description" content="Home"></head><body><div id="root"></div><script>
        document.getElementById('root').textContent = (localStorage.getItem('locale') || 'en') === 'fr' ? 'Accueil' : 'Home';
      </script></body></html>`,
    });
    const cli = await runCli([
      source,
      '--include',
      '/',
      '--no-crawl',
      '--no-audit',
      '--freeze-time',
      '2026-05-04T12:00:00Z',
      '--seo-locale',
      'fr',
      '--seo-locale-source',
      'localStorage',
      '--seo-locale-force-html-lang',
    ]);
    assert.equal(cli.status, 0, cli.stderr);
    const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
    assert.match(html, /Accueil/);
    assert.match(html, /<html lang="fr"/);
    assert.match(html, /data-snappy-seo-locale/);
  });
});
