import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../../src/core/browser.js';
import { resolveConfig } from '../../src/core/config.js';
import { startStaticServer } from '../../src/core/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedSource = path.join(here, '..', '..', 'testcase', 'shared');
let tempDir;
let server;
let browser;

after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

/**
 * Starts the shared runtime in a plain page so the test exercises the host-agnostic
 * controller without depending on a framework build output.
 */
async function startRuntimePage() {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-shared-runtime-'));
  await fs.cp(sharedSource, path.join(tempDir, 'shared'), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, 'index.html'),
    '<!doctype html><html lang="en"><head><title>Shared runtime</title></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
  );
  await fs.writeFile(
    path.join(tempDir, 'app.js'),
    `import { mountIslands } from './shared/runtime/islands.js';
import { createSiteApp } from './shared/runtime/site.js';

const root = document.getElementById('root');
const site = createSiteApp({
  renderHtml(html) {
    root.innerHTML = html;
  },
  mountIslands,
  getRoot: () => root,
});
site.start();
window.__site = site;
`,
  );
  server = await startStaticServer({ dir: tempDir, base: '/' });
  const launched = await launchBrowser(resolveConfig({ logLevel: 'silent' }), {
    info() {},
    warn() {},
    error() {},
    debug() {},
  });
  browser = launched.browser;
  return browser.newPage({ viewport: { width: 390, height: 844 } });
}

/**
 * Replays a client-side history navigation through the controller.
 * @param {import('playwright-core').Page} page
 * @param {string} location
 */
async function go(page, location) {
  await page.evaluate((next) => {
    history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, location);
  await page.waitForTimeout(150);
}

describe('shared runtime browser regressions', () => {
  let page;

  before(async () => {
    page = await startRuntimePage();
  });

  it('releases the mobile scroll lock and closes the menu on a current-page brand link', async () => {
    await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.site-header', { timeout: 15000 });
    await page.locator('[data-menu-toggle]').click();
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.locator('.brand').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-mobile-menu]').evaluate((node) => node.hidden), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  });

  it('keeps the palette open after an async preference render', async () => {
    await go(page, '/platform');
    await page.locator('[data-palette-open]').first().click();
    await page.locator('[data-palette-action="telemetry"]').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-palette]').evaluate((node) => node.hidden), false);
    assert.equal(
      await page.locator('[data-palette-action="telemetry"]').textContent(),
      'Telemetry off',
    );
  });

  it('applies locale metadata only while the locale lab is unlocked', async () => {
    await go(page, '/lab/head-parity?unlock=AETHER');
    await page.waitForSelector('.lab-frame', { timeout: 15000 });
    assert.deepEqual(
      await page.evaluate(() => ({
        lang: document.documentElement.lang,
        ogLocale: document.querySelector('meta[property="og:locale"]')?.content ?? null,
      })),
      { lang: 'fr', ogLocale: 'fr_FR' },
    );

    await go(page, '/platform');
    assert.deepEqual(
      await page.evaluate(() => ({
        lang: document.documentElement.lang,
        ogLocale: document.querySelector('meta[property="og:locale"]')?.content ?? null,
      })),
      { lang: 'en', ogLocale: null },
    );
  });

  it('removes an imperative lab dialog when navigating away', async () => {
    await go(page, '/lab/imperative-dialog');
    await page.waitForSelector('[data-demo-action]', { timeout: 15000 });
    await page.locator('[data-demo-action]').click();
    assert.equal(await page.locator('dialog.lab-dialog').count(), 1);
    await go(page, '/platform');
    assert.equal(await page.locator('dialog.lab-dialog').count(), 0);
  });

  it('removes the canonical link and sets noindex for a missing route', async () => {
    await go(page, '/platform');
    assert.ok(await page.locator('link[rel="canonical"]').count());
    await go(page, '/signal-lost');
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute('content'),
      'noindex,nofollow',
    );
  });
});
