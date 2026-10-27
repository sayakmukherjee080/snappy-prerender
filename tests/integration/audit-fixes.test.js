import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';

const tempDirs = [];

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

async function makeSite(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-audit-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return dir;
}

function page(title, links = []) {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('');
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${anchors}</body></html>`;
}

async function exists(target) {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
}

describe('audit fixes', () => {
  it('fails an empty page instead of writing a blank shell', async () => {
    const sourceDir = await makeSite({
      'index.html':
        '<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>',
      'app.js': '/* never mounts */',
    });
    const report = await prerender({ sourceDir, verify: false, logLevel: 'silent' });
    assert.equal(report.ok, false);
    assert.deepEqual(report.emptyPages, ['/']);
    assert.equal(
      report.errors.some((entry) => entry.message.includes('empty page')),
      true,
    );
  });

  it('fails the run when no route is rendered', async () => {
    const sourceDir = await makeSite({ 'index.html': page('Home') });
    const report = await prerender({
      sourceDir,
      include: ['/blog/*'],
      exclude: ['/'],
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(report.routes.length, 0);
    assert.equal(report.ok, false);
    assert.equal(
      report.errors.some((entry) => entry.message.includes('no routes were rendered')),
      true,
    );
  });

  it('reports duplicate pages and enforces the duplicate gate', async () => {
    const sourceDir = await makeSite({ 'index.html': page('Home', ['/typo', '/404']) });
    const report = await prerender({
      sourceDir,
      include: ['/', '/typo', '/404'],
      crawl: false,
      notFoundRoute: '/404',
      failOnDuplicateContent: true,
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(report.duplicatePages.length > 0, true);
    assert.equal(report.ok, false);
  });

  it('rebases relative stylesheet URLs when inlining and leaves @import sheets linked', async () => {
    const sourceDir = await makeSite({
      'index.html': page('Home', ['/about']),
      'about/index.html': [
        '<!doctype html><html><head><title>About</title>',
        '<link rel="stylesheet" href="/assets/app.css">',
        '<link rel="stylesheet" href="/assets/import.css">',
        '</head><body><h1>About</h1></body></html>',
      ].join(''),
      'assets/app.css': '.x { background: url(fonts/a.woff2); }',
      'assets/import.css': '@import url("base.css"); .y {}',
    });
    const report = await prerender({
      sourceDir,
      include: ['/about'],
      crawl: false,
      inlineCss: 'inline',
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(report.ok, true);
    const html = await fs.readFile(path.join(sourceDir, 'about', 'index.html'), 'utf8');
    assert.match(html, /url\(\/assets\/fonts\/a\.woff2\)/);
    assert.match(html, /href="\/assets\/import\.css"/);
  });

  it('removes build-origin metadata instead of shipping it', async () => {
    const sourceDir = await makeSite({
      'index.html':
        '<!doctype html><html><head><link rel="canonical" href="http://127.0.0.1:4321/"><meta property="og:url" content="http://127.0.0.1:4321/"></head><body><h1>Home</h1></body></html>',
    });
    await prerender({ sourceDir, verify: false, logLevel: 'silent' });
    const html = await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8');
    assert.equal(html.includes('127.0.0.1'), false);
  });

  it('verifies changed HTML even when its shared state script is unchanged', async () => {
    const sourceDir = await makeSite({
      'index.html':
        '<!doctype html><html><body><h1>version one</h1><script>window.snapSaveState=()=>({count:1})</script></body></html>',
    });
    const first = await prerender({
      sourceDir,
      externalScripts: true,
      verifyChangedOnly: true,
      logLevel: 'silent',
    });
    assert.equal(first.verification.routes.length, 1);

    await fs.writeFile(
      path.join(sourceDir, 'index.html'),
      '<!doctype html><html><body><h1>version two</h1><script>window.snapSaveState=()=>({count:1})</script></body></html>',
    );
    const second = await prerender({
      sourceDir,
      externalScripts: true,
      verifyChangedOnly: true,
      logLevel: 'silent',
    });
    assert.equal(second.verification?.routes.length, 1);
    assert.equal(second.verification.skipped, 0);
  });

  it('prunes pages the previous run generated but keeps assets', async () => {
    const sourceDir = await makeSite({ 'index.html': page('Home') });
    await prerender({
      sourceDir,
      include: ['/', '/about'],
      crawl: false,
      pruneStaleRoutes: true,
      notFoundRoute: null,
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(await exists(path.join(sourceDir, 'about', 'index.html')), true);

    const second = await prerender({
      sourceDir,
      include: ['/'],
      crawl: false,
      pruneStaleRoutes: true,
      notFoundRoute: null,
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(second.pruned.includes('about/index.html'), true);
    assert.equal(await exists(path.join(sourceDir, 'about', 'index.html')), false);
  });

  it('fails a navigation that answers with HTTP 404', async () => {
    const dir = await makeSite({
      'server.mjs': [
        "import http from 'node:http';",
        'const port = Number(process.argv[2]);',
        'http.createServer((request, response) => {',
        "  if (request.url === '/') { response.end('<h1>ready</h1>'); return; }",
        '  response.statusCode = 404;',
        "  response.end('missing');",
        '}).listen(port, "127.0.0.1");',
      ].join('\n'),
    });
    const port = 47000 + Math.floor(Math.random() * 1000);
    const server = path.join(dir, 'server.mjs');
    const report = await prerender(
      {
        serveCmd: `"${process.execPath}" "${server}" ${port}`,
        url: `http://127.0.0.1:${port}/`,
        include: ['/missing'],
        crawl: false,
        verify: false,
        logLevel: 'silent',
      },
      { log: { debug() {}, info() {}, warn() {}, error() {}, success() {} } },
    );
    assert.equal(report.ok, false);
    assert.equal(
      report.errors.some((entry) => entry.message.includes('HTTP 404')),
      true,
    );
  });

  it('reports failed same-origin requests and enforces the gate', async () => {
    const sourceDir = await makeSite({
      'index.html':
        '<!doctype html><html><body><h1>Home</h1><img src="/missing.png"></body></html>',
    });
    const report = await prerender({
      sourceDir,
      verify: false,
      failOnFailedRequest: true,
      logLevel: 'silent',
    });
    assert.equal(report.ok, false);
    assert.equal(
      report.failedRequests.some((entry) => entry.url.endsWith('/missing.png')),
      true,
    );
  });

  it('leaves an identical screenshot untouched on a rerun', async () => {
    const sourceDir = await makeSite({ 'index.html': page('Home') });
    const first = await prerender({
      sourceDir,
      saveAs: 'png',
      crawl: false,
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(first.files.find((entry) => entry.file === 'index.png').status, 'written');
    const second = await prerender({
      sourceDir,
      saveAs: 'png',
      crawl: false,
      verify: false,
      logLevel: 'silent',
    });
    assert.equal(second.files.find((entry) => entry.file === 'index.png').status, 'unchanged');
  });
});
