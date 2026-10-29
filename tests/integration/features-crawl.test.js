import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite, page, runCli } from './support.js';

after(cleanup);

function graphSite() {
  return makeStaticSite({
    'index.html': page('Home', ['/a', '/b', '/c']),
    'a/index.html': page('A', ['/deep']),
    'b/index.html': page('B', ['/deep']),
    'c/index.html': page('C', []),
    'deep/index.html': page('Deep', []),
  });
}

const base = {
  verify: false,
  audit: false,
  logLevel: 'silent',
  captureFormState: false,
  captureRuntimeStyles: false,
};

describe('prerender integration: deterministic crawl', () => {
  it('produces the same route set and dropped list at different concurrency', async () => {
    const first = await prerender({
      ...base,
      sourceDir: await graphSite(),
      maxRoutes: 3,
      concurrency: 1,
    });
    const second = await prerender({
      ...base,
      sourceDir: await graphSite(),
      maxRoutes: 3,
      concurrency: 8,
    });
    assert.deepEqual([...first.routes].sort(), ['/', '/a', '/b']);
    assert.deepEqual([...second.routes].sort(), [...first.routes].sort());
    assert.deepEqual(second.truncated, first.truncated);
    assert.deepEqual(first.truncated, {
      limit: 3,
      routes: 3,
      droppedRoutes: ['/c', '/deep'],
    });
  });

  it('ranks routes by routePriority before the path', async () => {
    const sourceDir = await graphSite();
    const report = await prerender({
      ...base,
      sourceDir,
      maxRoutes: 2,
      routePriority: ['/b'],
    });
    assert.deepEqual([...report.routes].sort(), ['/', '/b']);
    assert.deepEqual(report.truncated.droppedRoutes, ['/a', '/c', '/deep']);
  });

  it('stops crawling at maxDepth', async () => {
    const report = await prerender({
      ...base,
      sourceDir: await graphSite(),
      maxDepth: 0,
    });
    assert.deepEqual(report.routes, ['/']);
  });

  it('records crawl acceptance order instead of the sorted write order', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', ['/a', '/z']),
      'a/index.html': page('A', []),
      'z/index.html': page('Z', []),
    });
    const report = await prerender({
      ...base,
      sourceDir,
      maxRoutes: 3,
      routePriority: ['/z'],
    });
    const order = new Map(report.routeDetails.map((detail) => [detail.route, detail.order]));
    assert.equal(order.get('/'), 0);
    assert.equal(order.get('/z'), 1);
    assert.equal(order.get('/a'), 2);
  });

  it('renders only the routes a routesFile seeds and does not add the root', async () => {
    const sourceDir = await graphSite();
    const routesFile = path.join(sourceDir, 'routes.txt');
    await fs.writeFile(routesFile, '/a\n/deep\n');
    const report = await prerender({ ...base, sourceDir, routesFile });
    assert.deepEqual([...report.routes].sort(), ['/a', '/deep']);
    assert.equal(report.routeSources[0].routes, 2);
  });

  it('seeds routes from a sitemap', async () => {
    const sourceDir = await graphSite();
    const sitemap = path.join(sourceDir, 'sitemap-source.xml');
    await fs.writeFile(
      sitemap,
      '<urlset><url><loc>/b</loc></url><url><loc>/c</loc></url></urlset>',
    );
    const report = await prerender({
      ...base,
      sourceDir,
      routesFromSitemap: sitemap,
      crawl: false,
    });
    assert.deepEqual([...report.routes].sort(), ['/b', '/c']);
    assert.equal(report.routeSources[0].type, 'sitemap');
  });

  it('resolves a relative routesFile against the config file directory', async () => {
    const project = await makeStaticSite({
      'site/index.html': page('Home', ['/about']),
      'site/about/index.html': page('About', []),
      'config/routes.txt': '/about\n',
      'config/snappy.config.mjs': [
        'export default {',
        "  sourceDir: 'site',",
        "  routesFile: 'routes.txt',",
        "  reportPath: 'report.json',",
        "  logLevel: 'silent',",
        '};',
      ].join('\n'),
    });
    const run = await runCli(['--config', 'config/snappy.config.mjs'], { cwd: project });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(await fs.readFile(path.join(project, 'report.json'), 'utf8'));
    assert.deepEqual(
      report.routes.map((entry) => entry.route),
      ['/about'],
    );
    assert.match(report.routeSources[0].source, /config[/\\]routes\.txt$/);
  });

  it('accepts the new route, report, audit and output flags together', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', ['/about']),
      'about/index.html': page('About', []),
      'routes.txt': '/\n/about\n',
    });
    const run = await runCli(
      [
        '.',
        '--routes-file',
        'routes.txt',
        '--report',
        'report.json',
        '--no-audit',
        '--no-verify',
        '--preload-links',
        '--image-sitemap',
        '--sitemap',
        '--metadata-site-url',
        'https://example.com',
        '--framework',
        'react',
        '--log-level',
        'silent',
      ],
      { cwd: sourceDir },
    );
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(await fs.readFile(path.join(sourceDir, 'report.json'), 'utf8'));
    assert.deepEqual(report.routes.map((entry) => entry.route).sort(), ['/', '/about']);
    assert.equal(report.audit.warnings.length, 0);
    assert.equal(report.audit.errors.length, 0);
    assert.equal(report.verification, null);
    assert.equal(report.sitemap.routes, 2);
  });
});

describe('prerender integration: transformHtml', () => {
  it('runs an async transform after post-processing and before the write', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', ['/about']),
      'about/index.html': page('About', []),
    });
    const calls = [];
    const report = await prerender({
      ...base,
      sourceDir,
      include: ['/', '/about'],
      transformHtml: async (html, { route }) => {
        calls.push(route);
        if (route !== '/about') return html;
        return html.replace('</body>', '<meta name="x-transform" content="about"></body>');
      },
    });
    assert.equal(report.ok, true);
    assert.deepEqual(calls.sort(), ['/', '/about']);
    const html = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(html, /<meta name="x-transform" content="about">/);
  });

  it('still calls the transform in dry-run mode', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home', []) });
    const calls = [];
    await prerender({
      ...base,
      sourceDir,
      dryRun: true,
      transformHtml: (html, { route }) => {
        calls.push(route);
        return html;
      },
    });
    assert.deepEqual(calls, ['/']);
  });

  it('reports a transform error against its route and writes no page', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', []),
      'about/index.html': page('About', []),
    });
    const report = await prerender({
      ...base,
      sourceDir,
      include: ['/about'],
      transformHtml: () => {
        throw new Error('transform failed');
      },
    });
    assert.equal(report.ok, false);
    assert.equal(report.errors[0].route, '/about');
    assert.match(report.errors[0].message, /transform failed/);
    assert.equal(
      report.files.some((entry) => entry.route === '/about'),
      false,
    );
    const html = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(html, /<title>About<\/title>/);
  });

  it('rejects a non-string transform result with a clear message', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', []),
      'about/index.html': page('About', []),
    });
    const report = await prerender({
      ...base,
      sourceDir,
      include: ['/about'],
      transformHtml: () => ({ html: 'not a string' }),
    });
    assert.equal(report.ok, false);
    assert.match(report.errors[0].message, /transformHtml must return a string/);
  });
});
