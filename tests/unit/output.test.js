import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { routeToFile, routeToScreenshotFile, writeRouteHtml } from '../../src/core/output.js';

const tempDirs = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-output-'));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

describe('routeToFile', () => {
  it('maps the root route to index.html', () => {
    assert.equal(routeToFile('/', {}), 'index.html');
  });

  it('maps nested routes to directory indexes', () => {
    assert.equal(routeToFile('/about', {}), 'about/index.html');
    assert.equal(routeToFile('/blog/post', {}), 'blog/post/index.html');
  });

  it('maps routes to flat files when flatOutput is set', () => {
    assert.equal(routeToFile('/about', { flatOutput: true }), 'about.html');
    assert.equal(routeToFile('/blog/post', { flatOutput: true }), 'blog/post.html');
  });

  it('emits the configured not-found route as 404.html', () => {
    assert.equal(routeToFile('/404', { notFoundRoute: '/404' }), '404.html');
    assert.equal(routeToFile('/missing', { notFoundRoute: '/missing' }), '404.html');
    assert.equal(routeToFile('/about', { notFoundRoute: '/404' }), 'about/index.html');
  });
});

describe('routeToScreenshotFile', () => {
  it('maps the root route to index.png', () => {
    assert.equal(routeToScreenshotFile('/', {}), 'index.png');
  });

  it('maps nested routes to their path with the extension swapped', () => {
    assert.equal(routeToScreenshotFile('/about', {}), 'about.png');
    assert.equal(routeToScreenshotFile('/blog/post', {}), 'blog/post.png');
  });

  it('uses the jpeg extension when requested', () => {
    assert.equal(routeToScreenshotFile('/about', { saveAs: 'jpeg' }), 'about.jpeg');
  });
});

describe('writeRouteHtml', () => {
  it('writes new files and reports them as written', async () => {
    const dir = await makeTempDir();
    const result = await writeRouteHtml({
      dir,
      route: '/about',
      html: '<html>one</html>',
      config: {},
    });
    assert.equal(result.status, 'written');
    assert.equal(result.file, 'about/index.html');
    const written = await fs.readFile(path.join(dir, 'about', 'index.html'), 'utf8');
    assert.equal(written, '<html>one</html>');
  });

  it('leaves identical files untouched', async () => {
    const dir = await makeTempDir();
    await writeRouteHtml({ dir, route: '/', html: '<html>same</html>', config: {} });
    const second = await writeRouteHtml({ dir, route: '/', html: '<html>same</html>', config: {} });
    assert.equal(second.status, 'unchanged');
  });

  it('overwrites changed files', async () => {
    const dir = await makeTempDir();
    await writeRouteHtml({ dir, route: '/', html: '<html>old</html>', config: {} });
    const second = await writeRouteHtml({ dir, route: '/', html: '<html>new</html>', config: {} });
    assert.equal(second.status, 'written');
    const written = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
    assert.equal(written, '<html>new</html>');
  });

  it('writes nothing on dry runs', async () => {
    const dir = await makeTempDir();
    const result = await writeRouteHtml({
      dir,
      route: '/',
      html: '<html>dry</html>',
      config: { dryRun: true },
    });
    assert.equal(result.status, 'dry-run');
    const entries = await fs.readdir(dir);
    assert.deepEqual(entries, []);
  });
});
