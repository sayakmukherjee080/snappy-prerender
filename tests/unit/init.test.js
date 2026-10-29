import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolveConfig } from '../../src/core/config.js';
import {
  CONFIG_FILE,
  detectProjectDefaults,
  parseRouteList,
  renderConfigFile,
  writeConfigFile,
} from '../../src/core/init.js';

const tempDirs = [];

async function makeDir(files = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-init-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), contents);
  }
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

describe('detectProjectDefaults', () => {
  it('prefers the Vite build directory', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({ devDependencies: { vite: '7.3.6' } }),
      'package-lock.json': '{}',
    });
    assert.deepEqual(await detectProjectDefaults(dir), {
      sourceDir: 'dist',
      base: '/',
      usesVite: true,
      runner: 'npm',
      installed: false,
    });
  });

  it('reads a Create React App homepage into the base path', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({
        dependencies: { 'react-scripts': '5.0.1' },
        homepage: 'https://user.github.io/repo',
      }),
    });
    const detected = await detectProjectDefaults(dir);
    assert.equal(detected.sourceDir, 'build');
    assert.equal(detected.base, '/repo/');
  });

  it('prefers the Create React App build directory', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({ dependencies: { 'react-scripts': '5.0.1' } }),
    });
    const detected = await detectProjectDefaults(dir);
    assert.equal(detected.sourceDir, 'build');
    assert.equal(detected.usesVite, false);
  });

  it('detects Vite from a config file and the runner from a lockfile', async () => {
    const dir = await makeDir({
      'vite.config.ts': 'export default {}',
      'pnpm-lock.yaml': 'lockfileVersion: 9',
    });
    const detected = await detectProjectDefaults(dir);
    assert.equal(detected.usesVite, true);
    assert.equal(detected.runner, 'pnpm');
  });

  it('copes with a project that has no manifest at all', async () => {
    const detected = await detectProjectDefaults(await makeDir());
    assert.equal(detected.sourceDir, 'dist');
    assert.equal(detected.runner, 'npm');
  });

  it('reports whether the package is already installed', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({ devDependencies: { 'snappy-prerender': '2.6.0' } }),
    });
    assert.equal((await detectProjectDefaults(dir)).installed, true);
  });
});

describe('parseRouteList', () => {
  it('splits, trims and normalises routes', () => {
    assert.deepEqual(parseRouteList(' / , /about/ ,blog/post '), ['/', '/about', '/blog/post']);
  });

  it('keeps wildcards as written and falls back to the root route', () => {
    assert.deepEqual(parseRouteList('/blog/*'), ['/blog/*']);
    assert.deepEqual(parseRouteList('   '), ['/']);
    assert.deepEqual(parseRouteList(''), ['/']);
  });
});

describe('renderConfigFile', () => {
  it('produces a config the resolver accepts unchanged', async () => {
    const contents = renderConfigFile({
      sourceDir: 'build',
      base: '/app/',
      include: ['/', '/about'],
      crawl: false,
      siteUrl: 'https://example.com',
      siteName: 'Example',
      titleTemplate: '%s | Example',
      csp: 'strict',
      externalScripts: true,
      criticalCssPreload: false,
    });
    const dir = await makeDir({ [CONFIG_FILE]: contents });
    const loaded = (await import(pathToFileURL(path.join(dir, CONFIG_FILE)).href)).default;
    const config = resolveConfig(loaded);

    assert.equal(config.sourceDir, 'build');
    assert.equal(config.base, '/app/');
    assert.deepEqual(config.include, ['/', '/about']);
    assert.equal(config.crawl, false);
    assert.equal(config.metadata.siteUrl, 'https://example.com');
    assert.equal(config.metadata.titleTemplate, '%s | Example');
    assert.equal(config.csp, 'strict');
    assert.equal(config.externalScripts, true);
    assert.equal(config.criticalCssPreload, false);
    assert.deepEqual(config.warnings, []);
  });

  it('leaves out options the answers did not set', () => {
    const contents = renderConfigFile({ sourceDir: 'dist', base: '/', include: ['/'] });
    assert.equal(contents.includes('base:'), false);
    assert.equal(contents.includes('crawl:'), false);
    assert.equal(contents.includes('csp:'), false);
    assert.equal(contents.includes('metadata'), false);
    assert.equal(contents.includes('sourceDir: "dist"'), true);
    // The default include list would act as an allowlist and stop crawling, so it is omitted.
    assert.equal(contents.includes('include:'), false);
  });

  it('writes the include list once it narrows the routes', () => {
    const contents = renderConfigFile({ sourceDir: 'dist', include: ['/', '/about'] });
    assert.match(contents, /include: \["\/", "\/about"\]/);
  });

  it('renders the same bytes for the same answers', () => {
    const answers = { sourceDir: 'dist', include: ['/'], siteUrl: 'https://example.com' };
    assert.equal(renderConfigFile(answers), renderConfigFile(answers));
  });
});

describe('writeConfigFile', () => {
  it('writes a new config file and reports its path', async () => {
    const dir = await makeDir();
    const target = await writeConfigFile({ dir, contents: 'export default {};\n' });
    assert.equal(target, path.join(dir, CONFIG_FILE));
    assert.equal(await fs.readFile(target, 'utf8'), 'export default {};\n');
  });

  it('refuses to replace an existing config without force', async () => {
    const dir = await makeDir({ [CONFIG_FILE]: 'export default { crawl: false };\n' });
    await assert.rejects(
      () => writeConfigFile({ dir, contents: 'export default {};\n' }),
      /already exists/,
    );
    assert.equal(
      await fs.readFile(path.join(dir, CONFIG_FILE), 'utf8'),
      'export default { crawl: false };\n',
    );
  });

  it('replaces it when force is set', async () => {
    const dir = await makeDir({ [CONFIG_FILE]: 'export default { crawl: false };\n' });
    await writeConfigFile({ dir, contents: 'export default {};\n', force: true });
    assert.equal(await fs.readFile(path.join(dir, CONFIG_FILE), 'utf8'), 'export default {};\n');
  });
});

describe('react-snap migration', () => {
  it('maps renamed options and passes through the shared ones', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({
        reactSnap: {
          source: 'build',
          include: ['/', '/about'],
          puppeteerArgs: ['--no-sandbox'],
          puppeteerIgnoreHTTPSErrors: true,
          skipThirdPartyRequests: true,
          fixInsertRule: false,
          fixFormFields: false,
          http2PushManifest: true,
          cacheAjaxRequests: true,
          timeout: 60000,
          port: 3000,
          sourceMaps: true,
          unknownOption: 'x',
        },
      }),
    });
    const detected = await detectProjectDefaults(dir);
    assert.equal(detected.reactSnap.values.sourceDir, 'build');
    assert.deepEqual(detected.reactSnap.values.include, ['/', '/about']);
    assert.deepEqual(detected.reactSnap.values.browserArgs, ['--no-sandbox']);
    assert.equal(detected.reactSnap.values.ignoreHTTPSErrors, true);
    assert.equal(detected.reactSnap.values.blockThirdParty, true);
    assert.equal(detected.reactSnap.values.captureRuntimeStyles, false);
    assert.equal(detected.reactSnap.values.captureFormState, false);
    assert.equal(detected.reactSnap.values.preloadManifest, true);
    assert.equal(detected.reactSnap.values.cacheAjaxRequests, true);
    assert.equal(detected.reactSnap.values.timeout, 60000);
    assert.deepEqual(
      detected.reactSnap.ignored.map((entry) => entry.key),
      ['port', 'sourceMaps'],
    );
    assert.deepEqual(detected.reactSnap.unknown, ['unknownOption']);
  });

  it('normalises a single-string reactSnap include', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({ reactSnap: { include: '/about' } }),
    });
    const detected = await detectProjectDefaults(dir);
    assert.deepEqual(detected.reactSnap.values.include, ['/about']);
    const contents = renderConfigFile({
      sourceDir: 'dist',
      include: detected.reactSnap.values.include,
    });
    const configDir = await makeDir({ [CONFIG_FILE]: contents });
    const loaded = (await import(pathToFileURL(path.join(configDir, CONFIG_FILE)).href)).default;
    assert.deepEqual(resolveConfig(loaded).include, ['/about']);
  });

  it('omits the migration block when there is no reactSnap configuration', async () => {
    const dir = await makeDir({ 'package.json': JSON.stringify({ dependencies: {} }) });
    assert.equal((await detectProjectDefaults(dir)).reactSnap, undefined);
  });

  it('writes mapped options into a config the resolver accepts', async () => {
    const dir = await makeDir({
      'package.json': JSON.stringify({
        reactSnap: {
          source: 'build',
          include: ['/', '/about'],
          puppeteerArgs: ['--no-sandbox'],
          skipThirdPartyRequests: true,
          http2PushManifest: true,
          inlineCss: 'critical',
          timeout: 60000,
          viewport: { width: 800, height: 600 },
        },
      }),
    });
    const detected = await detectProjectDefaults(dir);
    const contents = renderConfigFile({
      sourceDir: detected.reactSnap.values.sourceDir,
      include: detected.reactSnap.values.include,
      extraOptions: detected.reactSnap.values,
    });
    const configDir = await makeDir({ [CONFIG_FILE]: contents });
    const loaded = (await import(pathToFileURL(path.join(configDir, CONFIG_FILE)).href)).default;
    const config = resolveConfig(loaded);
    assert.equal(config.sourceDir, 'build');
    assert.deepEqual(config.browserArgs, ['--no-sandbox']);
    assert.equal(config.blockThirdParty, true);
    assert.equal(config.preloadManifest, true);
    assert.equal(config.inlineCss, 'critical');
    assert.equal(config.timeout, 60000);
    assert.deepEqual(config.viewport, { width: 800, height: 600 });
    assert.equal(contents.includes('sourceDir: "build"'), true);
  });

  it('skips a function or RegExp value instead of writing broken syntax', () => {
    const contents = renderConfigFile({
      sourceDir: 'dist',
      extraOptions: {
        timeout: 1000,
        transformHtml: () => 'x',
        include: [/regex/],
      },
    });
    assert.equal(contents.includes('timeout: 1000'), true);
    assert.equal(contents.includes('transformHtml'), false);
    assert.equal(contents.includes('regex'), false);
  });
});
