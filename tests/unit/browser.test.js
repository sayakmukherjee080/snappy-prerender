import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { browserCacheDir } from '../../src/core/browser.js';

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
