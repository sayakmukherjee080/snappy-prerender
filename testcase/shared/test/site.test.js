import assert from 'node:assert/strict';
import test from 'node:test';
import { guardApiContent } from '../guard-api-content.js';
import { normalizeArticle } from '../lib/newsApi.js';
import { renderDocument, renderRoute } from '../render/index.js';
import { getAllRoutePaths, NOT_FOUND_ROUTE, routeCount, routes } from '../routes.js';
import { matchRoute } from '../runtime/router.js';

test('the shared manifest publishes 254 unique routes', () => {
  const paths = getAllRoutePaths();
  assert.equal(routeCount, 254);
  assert.equal(paths.length, 254);
  assert.equal(new Set(paths).size, 254);
});

test('every route has a page key, metadata, and a layout', () => {
  for (const route of routes) {
    assert.ok(route.page, `${route.path} is missing a page key`);
    assert.equal(typeof route.meta, 'function', `${route.path} is missing metadata`);
    assert.ok(route.layout, `${route.path} is missing a layout`);
  }
});

test('API article routes use the live article title and description', () => {
  const route = routes.find((item) => item.page === 'api-article');
  const page = renderRoute(
    route,
    { index: '1' },
    {
      path: '/api/articles/1',
      search: '',
      hash: '',
      preferences: {},
      hiddenUnlocked: false,
      news: {
        status: 'ready',
        data: {
          articles: [
            {
              title: 'A live article title',
              summary: 'A live article summary',
              newsSite: 'Example Space',
              url: 'https://example.com/article',
              imageUrl: null,
              publishedAt: '2026-10-31T00:00:00Z',
            },
          ],
        },
      },
    },
  );
  assert.equal(page.title, 'A live article title');
  assert.match(page.description, /^API article 1: A live article summary/);
});

test('the live article normaliser rejects unsafe URLs', () => {
  const article = normalizeArticle({
    id: 1,
    title: 'A live article',
    summary: '  Summary  ',
    news_site: 'Example',
    url: 'https://example.com/article',
    image_url: 'javascript:alert(1)',
    published_at: '2026-10-30T04:00:00Z',
  });
  assert.ok(article);
  assert.equal(article.summary, 'Summary');
  assert.equal(article.imageUrl, null);
  assert.equal(normalizeArticle({ title: '', url: 'https://example.com' }), null);
});

test('the API guard uses structural markers, not error text', () => {
  assert.throws(
    () => guardApiContent('<section class="api-skeleton"></section>', { route: '/api' }),
    /Live API source failed/,
  );
  assert.throws(
    () =>
      guardApiContent('<section class="api-error">That article is not in the feed.</section>', {
        route: '/api/articles/1',
      }),
    /Live API source failed/,
  );
  assert.equal(
    guardApiContent('<article class="api-article">The source is not responding</article>', {
      route: '/api/articles/1',
    }),
    '<article class="api-article">The source is not responding</article>',
  );
  assert.equal(
    guardApiContent('<a class="api-card">Live</a>', { route: '/api' }),
    '<a class="api-card">Live</a>',
  );
  assert.equal(
    guardApiContent('<a class="api-card">Live</a>', { route: '/api/' }),
    '<a class="api-card">Live</a>',
  );
});

test('a malformed percent escape does not throw while matching routes', () => {
  const manifest = [{ path: '/docs/:slug' }, { path: '/' }];
  assert.equal(matchRoute(manifest, '/docs/%E0%A4%A'), null);
  assert.deepEqual(matchRoute(manifest, '/docs/launch'), {
    route: manifest[0],
    params: { slug: 'launch' },
    score: 9,
  });
});

test('the not-found document is marked noindex and not canonicalised', () => {
  const page = renderDocument(
    NOT_FOUND_ROUTE,
    {},
    {
      path: '/signal-lost',
      search: '',
      hash: '',
      preferences: {},
      hiddenUnlocked: false,
      news: { status: 'idle', data: null },
    },
  );
  assert.equal(page.notFound, true);
  assert.equal(page.noindex, true);
  assert.match(page.html, /This page lost signal/);
});
