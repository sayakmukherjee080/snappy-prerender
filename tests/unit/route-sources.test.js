import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { loadRouteSeeds } from '../../src/core/route-sources.js';

const tempDirs = [];

async function makeDir(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-routes-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

describe('loadRouteSeeds routesFile', () => {
  it('reads one route per line and ignores comments', async () => {
    const dir = await makeDir({
      'routes.txt': '# public pages\n/\n/about\n\n/pricing # trailing comment\n/about\n',
    });
    const result = await loadRouteSeeds({ routesFile: path.join(dir, 'routes.txt') });
    assert.deepEqual(result.routes, ['/', '/about', '/pricing']);
    assert.deepEqual(result.sources, [
      {
        source: path.join(dir, 'routes.txt'),
        type: 'file',
        routes: 3,
        skipped: 1,
      },
    ]);
  });

  it('reads a JSON array and an object with a routes list', async () => {
    const dir = await makeDir({
      'array.json': '["/", "/about/", "/about"]',
      'object.json': '{"routes": ["/", "/network"]}',
    });
    assert.deepEqual((await loadRouteSeeds({ routesFile: path.join(dir, 'array.json') })).routes, [
      '/',
      '/about',
    ]);
    assert.deepEqual((await loadRouteSeeds({ routesFile: path.join(dir, 'object.json') })).routes, [
      '/',
      '/network',
    ]);
  });

  it('rejects malformed JSON and an unsupported shape', async () => {
    const dir = await makeDir({
      'bad.json': '{"routes": "nope"}',
      'broken.json': '["unterminated',
    });
    await assert.rejects(
      () => loadRouteSeeds({ routesFile: path.join(dir, 'bad.json') }),
      /must be an array or an object with a routes array/,
    );
    await assert.rejects(
      () => loadRouteSeeds({ routesFile: path.join(dir, 'broken.json') }),
      /not valid JSON/,
    );
  });

  it('falls back to a clear error when the file is missing', async () => {
    await assert.rejects(
      () => loadRouteSeeds({ routesFile: '/definitely/missing/routes.txt' }),
      /ENOENT/,
    );
  });
});

describe('loadRouteSeeds routesFromSitemap', () => {
  it('reads a local sitemap and normalises absolute same-origin URLs', async () => {
    const dir = await makeDir({
      'sitemap.xml': `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/</loc></url>
          <url><loc>https://example.com/about/</loc></url>
          <url><loc>https://other.example/x</loc></url>
        </urlset>`,
    });
    const result = await loadRouteSeeds({
      routesFromSitemap: path.join(dir, 'sitemap.xml'),
      metadata: { siteUrl: 'https://example.com' },
    });
    assert.deepEqual(result.routes, ['/', '/about']);
    assert.equal(result.sources[0].skipped, 1);
  });

  it('follows a sitemap index one level deep', async () => {
    const dir = await makeDir({
      'sitemap.xml': `<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>pages.xml</loc></sitemap>
        </sitemapindex>`,
      'pages.xml': `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>/platform</loc></url>
        </urlset>`,
    });
    const result = await loadRouteSeeds({
      routesFromSitemap: path.join(dir, 'sitemap.xml'),
    });
    assert.deepEqual(result.routes, ['/platform']);
  });

  it('strips the public base from root-relative sitemap locations', async () => {
    const dir = await makeDir({
      'sitemap.xml':
        '<urlset><url><loc>/app/about</loc></url><url><loc>/about</loc></url><url><loc>/app/</loc></url></urlset>',
    });
    const result = await loadRouteSeeds({
      routesFromSitemap: path.join(dir, 'sitemap.xml'),
      base: '/app/',
    });
    assert.deepEqual(result.routes, ['/about', '/']);
  });

  it('drops off-origin entries from a remote sitemap without metadata.siteUrl', async () => {
    const server = http.createServer((_request, response) => {
      response.setHeader('content-type', 'application/xml');
      response.end(
        `<urlset><url><loc>http://127.0.0.1:${server.address().port}/about</loc></url><url><loc>https://other.example/x</loc></url></urlset>`,
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const result = await loadRouteSeeds({
        routesFromSitemap: `http://127.0.0.1:${server.address().port}/sitemap.xml`,
      });
      assert.deepEqual(result.routes, ['/about']);
      assert.equal(result.sources[0].skipped, 1);
    } finally {
      await new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      });
    }
  });

  it('rejects a document that is not a sitemap', async () => {
    const dir = await makeDir({ 'sitemap.xml': '<html><body>nope</body></html>' });
    await assert.rejects(
      () => loadRouteSeeds({ routesFromSitemap: path.join(dir, 'sitemap.xml') }),
      /not a sitemap/,
    );
  });

  it('rejects a sitemap with no usable routes', async () => {
    const dir = await makeDir({
      'sitemap.xml': '<urlset><url><loc>https://other.example/x</loc></url></urlset>',
    });
    await assert.rejects(
      () =>
        loadRouteSeeds({
          routesFromSitemap: path.join(dir, 'sitemap.xml'),
          metadata: { siteUrl: 'https://example.com' },
        }),
      /did not contain any usable routes/,
    );
  });

  it('requires a reference origin for absolute locations in a local sitemap', async () => {
    const dir = await makeDir({
      'sitemap.xml': '<urlset><url><loc>https://example.com/about</loc></url></urlset>',
    });
    await assert.rejects(
      () => loadRouteSeeds({ routesFromSitemap: path.join(dir, 'sitemap.xml') }),
      /did not contain any usable routes/,
    );
  });
});

describe('loadRouteSeeds combined sources', () => {
  it('merges and deduplicates file and sitemap seeds', async () => {
    const dir = await makeDir({
      'routes.txt': '/\n/about\n',
      'sitemap.xml': '<urlset><url><loc>/about</loc></url><url><loc>/network</loc></url></urlset>',
    });
    const result = await loadRouteSeeds({
      routesFile: path.join(dir, 'routes.txt'),
      routesFromSitemap: path.join(dir, 'sitemap.xml'),
    });
    assert.deepEqual(result.routes, ['/', '/about', '/network']);
    assert.equal(result.sources.length, 2);
  });
});
