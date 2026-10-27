import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  browserCacheDir,
  browserSteps,
  downloadPercent,
  selectCachedChrome,
} from '../../src/core/browser.js';

const initial = process.env.SNAPPY_BROWSER_CACHE_DIR;

afterEach(() => {
  if (initial === undefined) delete process.env.SNAPPY_BROWSER_CACHE_DIR;
  else process.env.SNAPPY_BROWSER_CACHE_DIR = initial;
});

describe('browserCacheDir', () => {
  it('honours the SNAPPY_BROWSER_CACHE_DIR override', () => {
    process.env.SNAPPY_BROWSER_CACHE_DIR = path.join(os.tmpdir(), 'custom-browser-cache');
    assert.equal(browserCacheDir(), path.join(os.tmpdir(), 'custom-browser-cache'));
  });

  it('defaults to an absolute tool-owned directory in the platform cache', () => {
    delete process.env.SNAPPY_BROWSER_CACHE_DIR;
    const dir = browserCacheDir();
    assert.equal(path.isAbsolute(dir), true);
    assert.equal(dir.endsWith(path.join('snappy-prerender', 'browsers')), true);
  });
});

describe('browserSteps', () => {
  it('falls through every source only for auto', () => {
    assert.deepEqual(browserSteps('auto'), ['chrome', 'msedge', 'playwright', 'cache', 'download']);
  });

  it('never substitutes another browser for an explicit channel', () => {
    assert.deepEqual(browserSteps('chrome'), ['chrome']);
    assert.deepEqual(browserSteps('msedge'), ['msedge']);
  });

  it('uses the Playwright-managed Chromium only when chromium is requested', () => {
    assert.deepEqual(browserSteps('chromium'), ['playwright']);
  });
});

describe('selectCachedChrome', () => {
  const installed = [
    {
      browser: 'chromium',
      platform: 'linux',
      buildId: '130.0.0',
      executablePath: '/cache/chromium',
    },
    { browser: 'chrome', platform: 'linux', buildId: '131.0.1', executablePath: '/cache/old' },
    { browser: 'chrome', platform: 'linux', buildId: '132.0.2', executablePath: '/cache/new' },
    { browser: 'chrome', platform: 'win64', buildId: '132.0.2', executablePath: '/cache/windows' },
  ];

  it('picks a Chrome build for the current platform', () => {
    const match = selectCachedChrome(installed, { platform: 'linux' });
    assert.equal(match.buildId, '131.0.1');
  });

  it('honours a pinned build id instead of taking the first match', () => {
    const match = selectCachedChrome(installed, { platform: 'linux', buildId: '132.0.2' });
    assert.equal(match.executablePath, '/cache/new');
    assert.equal(selectCachedChrome(installed, { platform: 'linux', buildId: '999' }), null);
  });

  it('skips an install whose executable is missing', () => {
    const match = selectCachedChrome(installed, {
      platform: 'linux',
      executableExists: (file) => file === '/cache/new',
    });
    assert.equal(match.executablePath, '/cache/new');
  });

  it('returns null when nothing matches', () => {
    assert.equal(selectCachedChrome([], { platform: 'linux' }), null);
  });
});

describe('downloadPercent', () => {
  it('reports a percentage when the total size is known', () => {
    assert.equal(downloadPercent(50, 200), 25);
    assert.equal(downloadPercent(200, 200), 100);
  });

  it('reports zero when the server sends no content length', () => {
    assert.equal(downloadPercent(10, 0), 0);
    assert.equal(downloadPercent(0, 0), 0);
  });
});
