import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  crawlRoots,
  filterRoutes,
  matchesPattern,
  normaliseRoute,
  toAppRoute,
  toPublicPath,
  toServerUrl,
  withinDepth,
} from '../../src/core/routes.js';

describe('normaliseRoute', () => {
  it('adds a leading slash and strips trailing slashes', () => {
    assert.equal(normaliseRoute('about'), '/about');
    assert.equal(normaliseRoute('/about/'), '/about');
    assert.equal(normaliseRoute('/'), '/');
    assert.equal(normaliseRoute(''), '/');
  });

  it('strips query strings and hashes', () => {
    assert.equal(normaliseRoute('/search?q=x#top'), '/search');
  });

  it('resolves dot segments so routes cannot traverse the output directory', () => {
    assert.equal(normaliseRoute('/a/../b'), '/b');
    assert.equal(normaliseRoute('/../../etc/passwd'), '/etc/passwd');
  });
});

describe('matchesPattern', () => {
  it('matches exact strings only', () => {
    assert.equal(matchesPattern('/about', '/about'), true);
    assert.equal(matchesPattern('/about/team', '/about'), false);
  });

  it('matches prefixes when the pattern ends with a star', () => {
    assert.equal(matchesPattern('/blog/post', '/blog/*'), true);
    assert.equal(matchesPattern('/blogging', '/blog/*'), false);
  });

  it('supports regular expressions', () => {
    assert.equal(matchesPattern('/users/42', /^\/users\/\d+$/), true);
  });
});

describe('filterRoutes', () => {
  it('de-duplicates and normalises candidates', () => {
    const routes = filterRoutes(['/about', '/about/', 'about'], { include: [], exclude: [] });
    assert.deepEqual(routes, ['/about']);
  });

  it('applies include filters only when patterns are supplied', () => {
    const routes = filterRoutes(['/about', '/blog/post'], { include: ['/blog/*'], exclude: [] });
    assert.deepEqual(routes, ['/blog/post']);
  });

  it('lets exclude win over include', () => {
    const routes = filterRoutes(['/blog/post', '/blog/draft'], {
      include: ['/blog/*'],
      exclude: ['/blog/draft'],
    });
    assert.deepEqual(routes, ['/blog/post']);
  });
});

describe('toAppRoute', () => {
  it('strips the base path and normalises the remainder', () => {
    assert.equal(toAppRoute('http://localhost:1/base/about', '/base/'), '/about');
    assert.equal(toAppRoute('http://localhost:1/base', '/base/'), '/');
  });

  it('ignores links outside the base path and non-http links', () => {
    assert.equal(toAppRoute('http://localhost:1/other', '/base/'), null);
    assert.equal(toAppRoute('mailto:team@example.com', '/'), null);
    assert.equal(toAppRoute('not a url', '/'), null);
  });
});

describe('toServerUrl', () => {
  it('re-applies the base path to app routes', () => {
    assert.equal(
      toServerUrl('/about', '/base/', 'http://127.0.0.1:9'),
      'http://127.0.0.1:9/base/about',
    );
    assert.equal(toServerUrl('/about', '/', 'http://127.0.0.1:9'), 'http://127.0.0.1:9/about');
  });
});

describe('toPublicPath', () => {
  it('applies the base path to asset paths', () => {
    assert.equal(toPublicPath('/assets/app.js', '/'), '/assets/app.js');
    assert.equal(toPublicPath('/assets/app.js', '/app/'), '/app/assets/app.js');
  });
});

describe('crawlRoots', () => {
  it('falls back to the root route when include is empty', () => {
    assert.deepEqual(crawlRoots({ include: [] }), ['/']);
  });

  it('normalises and de-duplicates configured roots', () => {
    assert.deepEqual(crawlRoots({ include: ['/a/', 'a', '/b'] }), ['/a', '/b']);
  });

  it('never seeds wildcard patterns as literal routes', () => {
    assert.deepEqual(crawlRoots({ include: ['/blog/*', '/about'] }), ['/about']);
    assert.deepEqual(crawlRoots({ include: ['/blog/*'] }), ['/']);
  });

  it('drops excluded seeds so exclude cannot be bypassed by include', () => {
    assert.deepEqual(crawlRoots({ include: ['/', '/admin'], exclude: ['/admin'] }), ['/']);
  });
});

describe('withinDepth', () => {
  it('treats null as unlimited', () => {
    assert.equal(withinDepth(99, null), true);
  });

  it('enforces numeric limits', () => {
    assert.equal(withinDepth(1, 1), true);
    assert.equal(withinDepth(2, 1), false);
  });
});
