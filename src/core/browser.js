import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as browsers from '@puppeteer/browsers';
import { chromium } from 'playwright-core';
import { isExecutablePath } from './config.js';

/**
 * Resolves a usable Chromium-compatible browser, preferring the browser already on
 * the machine, then any Playwright cache, then a one-time Chrome for Testing
 * download. Returns the launched browser plus a human-readable source for logs.
 */
export async function launchBrowser(config, log) {
  if (isExecutablePath(config.browser)) {
    return {
      browser: await launch(config, { executablePath: config.browser }),
      source: config.browser,
    };
  }

  const attempts = [];
  const channels =
    config.browser === 'auto'
      ? ['chrome', 'msedge']
      : config.browser === 'chromium'
        ? []
        : [config.browser];

  for (const channel of channels) {
    try {
      const browser = await launch(config, { channel });
      return { browser, source: `system ${channel}` };
    } catch (error) {
      attempts.push(`${channel}: ${firstLine(error.message)}`);
    }
  }

  try {
    const browser = await launch(config, {});
    return { browser, source: 'playwright cache' };
  } catch (error) {
    attempts.push(`playwright cache: ${firstLine(error.message)}`);
  }

  if (!config.browserDownload) {
    throw new Error(
      `No usable browser found and browserDownload is disabled. Tried:\n  ${attempts.join('\n  ')}`,
    );
  }

  const executablePath = await downloadChrome(log);
  return {
    browser: await launch(config, { executablePath }),
    source: `downloaded ${executablePath}`,
  };
}

// Launches Chromium with the configured headless mode, extra args and target.
function launch(config, options) {
  return chromium.launch({
    headless: config.headless,
    args: config.browserArgs.length > 0 ? config.browserArgs : undefined,
    ...options,
  });
}

// Keeps launch failure summaries to a single line in the aggregated error.
function firstLine(message) {
  return String(message).split('\n')[0];
}

/**
 * Downloads Chrome for Testing into the tool's own cache directory. Used only when
 * neither a system browser nor a Playwright-managed browser is available. The
 * archive comes from Google's version-pinned HTTPS bucket via @puppeteer/browsers.
 * Chrome for Testing publishes no checksum feed, so no separate hash verification is
 * performed; browserDownload can be set to false to opt out of downloads entirely.
 */
async function downloadChrome(log) {
  const cacheDir = browserCacheDir();
  const buildId = await browsers.resolveBuildId(
    browsers.Browser.CHROME,
    browsers.detectBrowserPlatform(),
    'stable',
  );
  log.info(
    `No system Chrome or Edge found. Downloading Chrome for Testing ${buildId} to ${cacheDir}`,
  );
  const installed = await browsers.install({
    browser: browsers.Browser.CHROME,
    buildId,
    cacheDir,
    downloadProgressCallback: (downloaded, total) =>
      log.debug(`  downloaded ${Math.round((downloaded / total) * 100)}%`),
  });
  if (!fs.existsSync(installed.executablePath)) {
    throw new Error(`Chrome download reported success but ${installed.executablePath} is missing`);
  }
  return installed.executablePath;
}

/**
 * Cache location for downloaded browsers. Overridable through the
 * SNAPPY_BROWSER_CACHE_DIR environment variable.
 */
export function browserCacheDir() {
  const override = process.env.SNAPPY_BROWSER_CACHE_DIR;
  if (override) return override;
  const root =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
      : process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(root, 'snappy-prerender', 'browsers');
}
