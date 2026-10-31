import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeArticle } from '../../shared/lib/newsApi.js';
import { getAllRoutePaths, routeCount, routes } from '../../shared/routes.js';

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
