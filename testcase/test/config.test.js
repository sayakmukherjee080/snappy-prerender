import assert from 'node:assert/strict';
import test from 'node:test';
import siteConfig from '../snappy.config.js';
import labsConfig from '../snappy.labs.config.js';
import { getAllRoutePaths } from '../src/router/match.js';
import { routes } from '../src/routes/index.js';

test('the prerender config covers every published route plus the not-found page', () => {
  const published = getAllRoutePaths(routes);
  assert.deepEqual(siteConfig.include, [...published, '/404']);
  assert.equal(siteConfig.crawl, false);
  assert.equal(siteConfig.notFoundRoute, '/404');
});

test('the lab config targets every unlisted route with the unlock state', () => {
  const labPaths = getAllRoutePaths(routes).filter(
    (path) => path === '/lab' || path.startsWith('/lab/'),
  );
  assert.equal(labPaths.length, 24);
  assert.deepEqual(labsConfig.include, labPaths);
  assert.equal(labsConfig.routeOverrides[0].match, '/lab*');
});

test('the API content guard refuses source-error pages', () => {
  assert.throws(
    () =>
      siteConfig.transformHtml(
        '<section class="api-error"><h1>The source is not responding.</h1></section>',
        { route: '/api' },
      ),
    /Live API source failed/,
  );
  assert.throws(
    () =>
      siteConfig.transformHtml(
        '<section class="api-error"><h1>That article is not in the feed.</h1></section>',
        { route: '/api/articles/1' },
      ),
    /Live API source failed/,
  );
  assert.equal(
    siteConfig.transformHtml('<article class="api-article">ok</article>', {
      route: '/api/articles/1',
    }),
    '<article class="api-article">ok</article>',
  );
  assert.equal(
    siteConfig.transformHtml('<section>The source is not responding</section>', {
      route: '/platform',
    }),
    '<section>The source is not responding</section>',
  );
});
