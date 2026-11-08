import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normaliseLlmsTxt } from '../../src/core/config.js';
import { buildLlmsTxt } from '../../src/core/llms-txt.js';

function config({ llmsTxt = true, ...overrides } = {}) {
  return {
    base: '/',
    flatOutput: false,
    notFoundRoute: '/404',
    metadata: { siteUrl: 'https://example.com', siteName: 'Example' },
    llmsTxt: normaliseLlmsTxt(llmsTxt),
    ...overrides,
  };
}

function page(route, file, meta = {}, extra = {}) {
  return { route, file, status: 'written', meta, ...extra };
}

describe('normaliseLlmsTxt', () => {
  it('normalises the default, boolean and object forms', () => {
    const off = normaliseLlmsTxt(false);
    assert.equal(off.enabled, false);
    assert.equal(off.file, 'llms.txt');
    assert.equal(normaliseLlmsTxt(true).enabled, true);
    const custom = normaliseLlmsTxt({
      enabled: true,
      file: 'ai/llms.txt',
      title: ' Example ',
      description: ' Summary ',
      include: ['/docs/*'],
      exclude: ['/private'],
      maxRoutes: 12,
    });
    assert.equal(custom.enabled, true);
    assert.equal(custom.file, 'ai/llms.txt');
    assert.equal(custom.title, 'Example');
    assert.equal(custom.description, 'Summary');
    assert.deepEqual(custom.include, ['/docs/*']);
    assert.deepEqual(custom.exclude, ['/private']);
    assert.equal(custom.maxRoutes, 12);
  });

  it('rejects malformed files, patterns and caps', () => {
    assert.throws(() => normaliseLlmsTxt({ file: '' }), /llmsTxt.file/);
    assert.throws(() => normaliseLlmsTxt({ file: '/llms.txt' }), /relative/);
    assert.throws(() => normaliseLlmsTxt({ file: '../llms.txt' }), /parent/);
    assert.throws(() => normaliseLlmsTxt({ file: 'index.html' }), /\.txt/);
    assert.throws(() => normaliseLlmsTxt({ file: 'robots.txt' }), /robots\.txt/);
    assert.throws(() => normaliseLlmsTxt({ include: [1] }), /llmsTxt.include/);
    assert.throws(() => normaliseLlmsTxt({ maxRoutes: 0 }), /llmsTxt.maxRoutes/);
    assert.throws(() => normaliseLlmsTxt({ nope: true }), /llmsTxt.nope/);
  });
});

describe('buildLlmsTxt', () => {
  it('writes headings, sections, absolute links and descriptions', () => {
    const built = buildLlmsTxt({
      files: [
        page('/', 'index.html', { title: 'Home', description: 'Welcome' }),
        page('/docs', 'docs/index.html', { title: 'Docs', description: 'Guides' }),
        page('/docs/api', 'docs/api/index.html', { title: 'API' }),
      ],
      config: config(),
    });
    assert.ok(built);
    assert.equal(built.routes, 3);
    assert.deepEqual(built.sections, [
      { name: 'Main', routes: 1 },
      { name: 'Docs', routes: 2 },
    ]);
    assert.match(built.contents, /^# Example/);
    assert.match(built.contents, /> Welcome/);
    assert.match(built.contents, /## Main/);
    assert.match(built.contents, /## Docs/);
    assert.match(built.contents, /\[Home\]\(https:\/\/example\.com\/\): Welcome/);
    assert.match(built.contents, /\[Docs\]\(https:\/\/example\.com\/docs\/\): Guides/);
    assert.match(built.contents, /\[API\]\(https:\/\/example\.com\/docs\/api\/\)/);
  });

  it('uses relative links without a site URL and keeps base and flat output', () => {
    const built = buildLlmsTxt({
      files: [page('/about', 'about.html', { title: 'About' })],
      config: config({
        base: '/app/',
        flatOutput: true,
        metadata: { trailingSlash: 'never' },
      }),
    });
    assert.match(built.contents, /\[About\]\(\/app\/about\)/);
  });

  it('uses a locale URL when one is available', () => {
    const built = buildLlmsTxt({
      files: [
        page(
          '/fr',
          'fr/index.html',
          { title: 'Accueil' },
          { localeUrl: 'https://fr.example.com/fr/' },
        ),
      ],
      config: config(),
    });
    assert.match(built.contents, /https:\/\/fr\.example\.com\/fr\//);
  });

  it('skips noindex, not-found, duplicate and unselected routes', () => {
    const built = buildLlmsTxt({
      files: [
        page('/', 'index.html', { title: 'Home' }),
        page('/private', 'private/index.html', { title: 'Private' }, { noindex: true }),
        page('/404', '404.html', { title: 'Missing' }),
        page('/about', 'about/index.html', { title: 'About' }),
        page('/about', 'about/index.html', { title: 'About again' }),
        page('/docs', 'docs/index.html', { title: 'Docs' }),
      ],
      config: config({ llmsTxt: { exclude: ['/docs'] } }),
    });
    assert.equal(built.routes, 2);
    assert.equal(built.contents.includes('/private/'), false);
    assert.equal(built.contents.includes('404'), false);
    assert.equal(built.contents.includes('/docs/'), false);
    assert.equal(built.contents.match(/\[About\]/g).length, 1);
  });

  it('applies include patterns and maxRoutes after stable sorting', () => {
    const built = buildLlmsTxt({
      files: [
        page('/', 'index.html', { title: 'Home' }),
        page('/docs/b', 'docs/b/index.html', { title: 'B' }),
        page('/docs/a', 'docs/a/index.html', { title: 'A' }),
        page('/blog', 'blog/index.html', { title: 'Blog' }),
      ],
      config: config({ llmsTxt: { include: ['/docs/*'], maxRoutes: 1 } }),
    });
    assert.equal(built.routes, 1);
    assert.match(built.contents, /\[A\]/);
    assert.equal(built.contents.includes('[B]'), false);
  });

  it('escapes Markdown text and link destinations', () => {
    const built = buildLlmsTxt({
      files: [page('/draft[1]', 'draft/index.html', { title: 'Draft [1]' })],
      config: config(),
    });
    assert.match(built.contents, /\[Draft \\\[1\\\]\]/);
    assert.match(built.contents, /draft%5B1%5D\/|draft\\\[1\\\]/);
  });

  it('returns null when no route qualifies', () => {
    assert.equal(
      buildLlmsTxt({
        files: [page('/404', '404.html', { title: 'Missing' })],
        config: config(),
      }),
      null,
    );
  });
});
