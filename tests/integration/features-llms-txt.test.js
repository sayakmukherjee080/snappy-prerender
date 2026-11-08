import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite, runCli } from './support.js';

const cacheDirs = [];
const outputDirs = [];
after(async () => {
  for (const dir of cacheDirs) await fs.rm(dir, { recursive: true, force: true });
  for (const dir of outputDirs) await fs.rm(dir, { recursive: true, force: true });
  await cleanup();
});

async function cachePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-llms-cache-'));
  cacheDirs.push(dir);
  return path.join(dir, 'cache.json');
}

async function outputDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-llms-out-'));
  outputDirs.push(dir);
  return dir;
}

function page(title, description, options = {}) {
  const robots = options.noindex ? '<meta name="robots" content="noindex">' : '';
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}">${robots}</head><body><h1>${title}</h1></body></html>`;
}

function options(sourceDir, overrides = {}) {
  return {
    sourceDir,
    crawl: false,
    verify: false,
    audit: false,
    logLevel: 'silent',
    captureFormState: false,
    captureRuntimeStyles: false,
    metadata: { siteUrl: 'https://example.com', siteName: 'Example' },
    ...overrides,
  };
}

function llmsSite() {
  return makeStaticSite({
    'index.html': page('Home', 'Welcome'),
    'docs/index.html': page('Docs', 'Guides'),
    'private/index.html': page('Private', 'Hidden', { noindex: true }),
    '404.html': page('Missing', 'Missing page'),
  });
}

describe('prerender integration: llms.txt', () => {
  it('writes a route index and records it in the report', async () => {
    const sourceDir = await llmsSite();
    const report = await prerender({
      ...options(sourceDir),
      include: ['/', '/docs', '/private', '/404'],
      llmsTxt: true,
    });
    assert.equal(report.ok, true);
    assert.equal(report.llmsTxt.file, 'llms.txt');
    assert.equal(report.llmsTxt.routes, 2);
    assert.deepEqual(report.llmsTxt.sections, [
      { name: 'Main', routes: 1 },
      { name: 'Docs', routes: 1 },
    ]);
    assert.equal(
      report.files.some((file) => file.file === 'llms.txt'),
      true,
    );
    const contents = await fs.readFile(path.join(sourceDir, 'llms.txt'), 'utf8');
    assert.match(contents, /^# Example/);
    assert.match(contents, /> Welcome/);
    assert.match(contents, /\[Home\]\(https:\/\/example\.com\/\): Welcome/);
    assert.match(contents, /\[Docs\]\(https:\/\/example\.com\/docs\/\): Guides/);
    assert.equal(contents.includes('/private/'), false);
    assert.equal(contents.includes('404'), false);
  });

  it('honours a custom file, title and description', async () => {
    const sourceDir = await llmsSite();
    const report = await prerender({
      ...options(sourceDir),
      include: ['/'],
      llmsTxt: {
        file: 'ai/llms.txt',
        title: 'Example AI',
        description: 'Route index for models',
      },
    });
    assert.equal(report.llmsTxt.file, 'ai/llms.txt');
    const contents = await fs.readFile(path.join(sourceDir, 'ai/llms.txt'), 'utf8');
    assert.match(contents, /^# Example AI/);
    assert.match(contents, /> Route index for models/);
  });

  it('leaves the output untouched when disabled', async () => {
    const sourceDir = await llmsSite();
    await prerender({ ...options(sourceDir), include: ['/'] });
    assert.equal(
      await fs.stat(path.join(sourceDir, 'llms.txt')).then(
        () => true,
        () => false,
      ),
      false,
    );
  });

  it('keeps the file unchanged on an all-cached incremental run', async () => {
    const sourceDir = await llmsSite();
    const destination = await outputDir();
    const cache = await cachePath();
    const runOptions = {
      ...options(sourceDir, { destination }),
      include: ['/', '/docs'],
      llmsTxt: true,
      incremental: { cachePath: cache },
    };
    const first = await prerender(runOptions);
    const firstContents = await fs.readFile(path.join(destination, 'llms.txt'), 'utf8');
    const second = await prerender(runOptions);
    assert.equal(first.llmsTxt.status, 'written');
    assert.equal(
      second.routeDetails.every((detail) => detail.status === 'cached'),
      true,
    );
    assert.equal(second.llmsTxt.status, 'unchanged');
    assert.equal(await fs.readFile(path.join(destination, 'llms.txt'), 'utf8'), firstContents);
  });

  it('does not write the file in dry-run mode', async () => {
    const sourceDir = await llmsSite();
    const report = await prerender({
      ...options(sourceDir),
      include: ['/'],
      llmsTxt: true,
      dryRun: true,
    });
    assert.equal(report.llmsTxt.status, 'dry-run');
    assert.equal(
      report.files.some((file) => file.file === 'llms.txt' && file.status === 'dry-run'),
      true,
    );
    assert.equal(
      await fs.stat(path.join(sourceDir, 'llms.txt')).then(
        () => true,
        () => false,
      ),
      false,
    );
  });

  it('skips the file for image output', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home', 'Welcome') });
    const destination = await outputDir();
    const report = await prerender({
      ...options(sourceDir, { destination }),
      include: ['/'],
      llmsTxt: true,
      saveAs: 'png',
    });
    assert.equal(report.llmsTxt, null);
    assert.equal(
      await fs.stat(path.join(destination, 'llms.txt')).then(
        () => true,
        () => false,
      ),
      false,
    );
  });

  it('uses the public base path in links', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', 'Welcome'),
      'docs/index.html': page('Docs', 'Guides'),
    });
    const destination = await outputDir();
    const report = await prerender({
      ...options(sourceDir, { destination }),
      include: ['/', '/docs'],
      base: '/app/',
      llmsTxt: true,
    });
    assert.equal(report.ok, true);
    const contents = await fs.readFile(path.join(destination, 'llms.txt'), 'utf8');
    assert.match(contents, /https:\/\/example\.com\/app\/docs\//);
  });

  it('writes the file through the CLI flags', async () => {
    const sourceDir = await makeStaticSite({ 'index.html': page('Home', 'Welcome') });
    const result = await runCli([
      sourceDir,
      '--no-verify',
      '--no-audit',
      '--metadata-site-url',
      'https://example.com',
      '--llms-txt',
      '--llms-txt-file',
      'ai/llms.txt',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const contents = await fs.readFile(path.join(sourceDir, 'ai/llms.txt'), 'utf8');
    assert.match(contents, /https:\/\/example\.com\//);
  });

  it('lists localized routes with their locale URLs', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': page('Home', 'Welcome'),
      'fr/index.html': page('Accueil', 'Bienvenue'),
    });
    const destination = await outputDir();
    const report = await prerender({
      ...options(sourceDir, { destination }),
      include: ['/'],
      locales: {
        mode: 'path',
        default: 'en',
        xDefault: 'en',
        hreflang: true,
        list: [
          { code: 'en', prefix: '' },
          { code: 'fr', prefix: '/fr' },
        ],
      },
      llmsTxt: true,
    });
    assert.equal(report.ok, true);
    const contents = await fs.readFile(path.join(destination, 'llms.txt'), 'utf8');
    assert.match(contents, /https:\/\/example\.com\/fr\//);
    assert.match(contents, /\[Accueil\]/);
  });
});
