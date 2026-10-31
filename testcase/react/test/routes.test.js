import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllRoutePaths, matchRoute } from '../src/router/match.js';
import { routeCount, routes } from '../src/routes/index.js';

test('the route manifest publishes exactly 254 unique pages', () => {
  const paths = getAllRoutePaths(routes);
  assert.equal(routeCount, 254);
  assert.equal(paths.length, 254);
  assert.equal(new Set(paths).size, 254);
});

test('every published path resolves to the route that declared it', () => {
  for (const route of routes) {
    for (const path of route.staticPaths ?? [route.path]) {
      const match = matchRoute(routes, path);
      assert.ok(match, `No match for ${path}`);
      assert.equal(match.route.path, route.path, `Wrong route for ${path}`);
    }
  }
});

test('every route has a loader, metadata function, and layout', () => {
  for (const route of routes) {
    assert.equal(typeof route.load, 'function', `${route.path} has no loader`);
    assert.equal(typeof route.meta, 'function', `${route.path} has no meta`);
    assert.ok(route.layout, `${route.path} has no layout`);
  }
});

test('hidden routes are limited to the lab', () => {
  const hidden = routes.filter((route) => route.hidden);
  assert.equal(hidden.length, 24);
  assert.ok(hidden.every((route) => route.path === '/lab' || route.path.startsWith('/lab/')));
});

test('a malformed percent escape falls through to the not-found route', () => {
  assert.equal(matchRoute(routes, '/docs/api/%E0%A4%A'), null);
  const valid = matchRoute(routes, '/docs/api/chat-completions');
  assert.ok(valid);
  assert.equal(valid.route.path, '/docs/api/:slug');
  assert.equal(valid.params.slug, 'chat-completions');
});
