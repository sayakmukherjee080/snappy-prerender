import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { isExecutablePath } from './config.js';

/**
 * Lists the resolution steps for a browser option. Explicit choices only ever try the
 * browser they name, so a machine without Chrome cannot silently prerender in Edge;
 * `auto` is the only choice that falls through the machine, the Playwright cache, a
 * cached Chrome for Testing, and finally a download.
 */
export function browserSteps(browser) {
  if (browser === 'auto') return ['chrome', 'msedge', 'playwright', 'cache', 'download'];
  if (browser === 'chromium') return ['playwright'];
  if (browser === 'chrome' || browser === 'msedge') return [browser];
  return [];
}

/**
 * Resolves a usable Chromium-compatible browser. Explicit channel choices fail rather
 * than falling back, while `auto` prefers the machine's browser, then any cached
 * download, then a one-time Chrome for Testing install.
 */
export async function launchBrowser(config, log) {
  if (isExecutablePath(config.browser)) {
    return {
      browser: await launch(config, { executablePath: config.browser }),
      source: config.browser,
    };
  }

  const attempts = [];
  for (const step of browserSteps(config.browser)) {
    try {
      const launched = await runStep(step, config, log);
      if (launched) return launched;
    } catch (error) {
      attempts.push(`${step}: ${firstLine(error.message)}`);
    }
  }

  if (!config.browserDownload) {
    throw new Error(
      `No usable browser found and browserDownload is disabled. Tried:\n  ${attempts.join('\n  ')}`,
    );
  }
  if (config.browser === 'chromium') {
    throw new Error(
      `No Playwright-managed Chromium is installed. Run "npx playwright install chromium", or set browser to auto or chrome. Tried:\n  ${attempts.join('\n  ')}`,
    );
  }
  throw new Error(`No usable browser found. Tried:\n  ${attempts.join('\n  ')}`);
}

// Runs one browser resolution step and returns the launched browser, or null when the
// step has nothing to offer on this machine.
async function runStep(step, config, log) {
  if (step === 'chrome' || step === 'msedge') {
    return { browser: await launch(config, { channel: step }), source: `system ${step}` };
  }
  if (step === 'playwright') {
    return { browser: await launch(config, {}), source: 'playwright cache' };
  }
  if (step === 'cache') {
    const cached = await findCachedChrome(config);
    if (!cached) return null;
    return {
      browser: await launch(config, { executablePath: cached.executablePath }),
      source: `cached Chrome for Testing ${cached.buildId}`,
    };
  }
  if (step === 'download') {
    if (!config.browserDownload) return null;
    const executablePath = await downloadChrome(config, log);
    return {
      browser: await launch(config, { executablePath }),
      source: `downloaded ${executablePath}`,
    };
  }
  return null;
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
 * Finds a Chrome for Testing build already present in the tool's cache, so a rebuild
 * never needs the version feed or a download when a browser is available offline.
 * Honours browserDownloadVersion when one is configured.
 */
async function findCachedChrome(config) {
  const browsers = await import('@puppeteer/browsers');
  const platform = browsers.detectBrowserPlatform();
  if (!platform) return null;
  const installed = browsers.getInstalledBrowsers({ cacheDir: browserCacheDir() });
  const match = installed.find(
    (entry) =>
      entry.browser === browsers.Browser.CHROME &&
      entry.platform === platform &&
      (!config.browserDownloadVersion || entry.buildId === config.browserDownloadVersion) &&
      fs.existsSync(entry.executablePath),
  );
  return match ?? null;
}

/**
 * Downloads Chrome for Testing into the tool's own cache directory. The archive comes
 * from Google's version-pinned HTTPS bucket via @puppeteer/browsers, which verifies it
 * against browserDownloadHash when one is configured and deletes it on a mismatch.
 * Without a configured hash the download is trusted on the strength of HTTPS alone,
 * which is logged as a warning.
 */
async function downloadChrome(config, log) {
  const browsers = await import('@puppeteer/browsers');
  const platform = browsers.detectBrowserPlatform();
  if (!platform) {
    throw new Error(`Cannot download a browser for ${os.platform()} (${os.arch()})`);
  }
  const cacheDir = browserCacheDir();
  const buildId =
    config.browserDownloadVersion ??
    (await browsers.resolveBuildId(browsers.Browser.CHROME, platform, 'stable'));
  if (config.browserDownloadHash) {
    log.info(
      `Downloading Chrome for Testing ${buildId}, verifying SHA-256 against browserDownloadHash`,
    );
  } else {
    log.warn(
      `Downloading Chrome for Testing ${buildId} to ${cacheDir} without a checksum; set browserDownloadHash to pin one`,
    );
  }
  const installed = await browsers.install({
    browser: browsers.Browser.CHROME,
    buildId,
    cacheDir,
    expectedHash: config.browserDownloadHash ?? undefined,
    downloadProgressCallback: (downloaded, total) =>
      log.debug(`  downloaded ${total > 0 ? Math.round((downloaded / total) * 100) : 0}%`),
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
