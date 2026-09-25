import assert from 'node:assert/strict';
import os from 'node:os';
import { describe, it } from 'node:test';
import {
  DEFAULTS,
  isExecutablePath,
  MAX_DEFAULT_CONCURRENCY,
  resolveConfig,
} from '../../src/core/config.js';

describe('resolveConfig', () => {
  it('applies documented defaults', () => {
    const config = resolveConfig();
    assert.equal(config.base, '/');
    assert.deepEqual(config.include, ['/']);
    assert.equal(config.timeout, DEFAULTS.timeout);
    assert.equal(config.verify, true);
    assert.equal(config.failOnHydrationError, false);
    assert.equal(config.scrollStepDelay, DEFAULTS.scrollStepDelay);
    assert.equal(config.shutdownTimeout, DEFAULTS.shutdownTimeout);
    assert.equal(config.includeProvided, false);
    assert.equal(config.maxRoutes, null);
  });

  it('applies the react-snap compatible capture and optimisation defaults', () => {
    const config = resolveConfig();
    assert.equal(config.userAgent, 'SnappyPrerender');
    assert.equal(config.destination, null);
    assert.equal(config.ignoreHTTPSErrors, false);
    assert.equal(config.blockThirdParty, false);
    assert.equal(config.preconnectThirdParty, true);
    assert.deepEqual(config.browserArgs, []);
    assert.equal(config.inlineCss, false);
    assert.equal(config.minifyHtml, false);
    assert.equal(config.minifyCss, false);
    assert.equal(config.saveAs, 'html');
    assert.equal(config.removeBlobs, true);
    assert.equal(config.captureRuntimeStyles, true);
    assert.equal(config.captureFormState, true);
    assert.equal(config.removeStyleTags, false);
    assert.equal(config.removeScriptTags, false);
    assert.equal(config.asyncScriptTags, false);
    assert.equal(config.preconnectThirdParty, true);
    assert.equal(config.preloadImages, false);
    assert.equal(config.preloadManifest, false);
    assert.deepEqual(config.ignoreForPreload, ['service-worker.js']);
    assert.equal(config.cacheAjaxRequests, false);
  });

  it('derives concurrency from the machine within the documented cap', () => {
    const config = resolveConfig();
    assert.equal(Number.isInteger(config.concurrency), true);
    assert.equal(config.concurrency >= 1, true);
    assert.equal(
      config.concurrency <=
        Math.max(1, Math.min(os.availableParallelism(), MAX_DEFAULT_CONCURRENCY)),
      true,
    );
  });

  it('normalises base, include and exclude shapes', () => {
    const config = resolveConfig({ base: 'app', include: '/about', exclude: '/admin/*' });
    assert.equal(config.base, '/app/');
    assert.deepEqual(config.include, ['/about']);
    assert.deepEqual(config.exclude, ['/admin/*']);
  });

  it('tracks whether include was supplied so defaults do not act as an allowlist', () => {
    assert.equal(resolveConfig().includeProvided, false);
    assert.equal(resolveConfig({ include: ['/about'] }).includeProvided, true);
  });

  it('merges partial viewport overrides', () => {
    const config = resolveConfig({ viewport: { width: 800 } });
    assert.equal(config.viewport.width, 800);
    assert.equal(config.viewport.height, DEFAULTS.viewport.height);
  });

  it('rejects invalid values', () => {
    assert.throws(() => resolveConfig({ concurrency: 0 }), /concurrency/);
    assert.throws(() => resolveConfig({ timeout: -1 }), /timeout/);
    assert.throws(() => resolveConfig({ scrollStepDelay: 0 }), /scrollStepDelay/);
    assert.throws(() => resolveConfig({ shutdownTimeout: -1 }), /shutdownTimeout/);
    assert.throws(() => resolveConfig({ logLevel: 'loud' }), /logLevel/);
    assert.throws(() => resolveConfig({ browser: 'safari' }), /browser/);
    assert.throws(() => resolveConfig({ include: [42] }), /include/);
    assert.throws(() => resolveConfig({ allowedHosts: [42] }), /allowedHosts/);
    assert.throws(() => resolveConfig({ readyFlag: 42 }), /readyFlag/);
    assert.throws(() => resolveConfig({ waitFor: 42 }), /waitFor/);
    assert.throws(() => resolveConfig({ notFoundRoute: 42 }), /notFoundRoute/);
    assert.throws(() => resolveConfig({ maxDepth: -2 }), /maxDepth/);
    assert.throws(() => resolveConfig({ maxRoutes: 0 }), /maxRoutes/);
    assert.throws(() => resolveConfig({ maxRoutes: -1 }), /maxRoutes/);
    assert.throws(() => resolveConfig({ maxRoutes: 1.5 }), /maxRoutes/);
    assert.throws(() => resolveConfig({ storageState: 'does-not-exist.json' }), /storageState/);
    assert.throws(() => resolveConfig({ userAgent: 42 }), /userAgent/);
    assert.throws(() => resolveConfig({ destination: 42 }), /destination/);
    assert.throws(() => resolveConfig({ browserArgs: [1] }), /browserArgs/);
    assert.throws(() => resolveConfig({ ignoreForPreload: [1] }), /ignoreForPreload/);
    assert.throws(() => resolveConfig({ inlineCss: 'partial' }), /inlineCss/);
    assert.throws(() => resolveConfig({ saveAs: 'webp' }), /saveAs/);
    assert.throws(() => resolveConfig({ minifyHtml: 'yes' }), /minifyHtml/);
    assert.throws(() => resolveConfig({ minifyCss: [] }), /minifyCss/);
    assert.throws(() => resolveConfig({ removeScriptTags: 'yes' }), /removeScriptTags/);
    assert.throws(() => resolveConfig({ captureRuntimeStyles: 'yes' }), /captureRuntimeStyles/);
    assert.throws(() => resolveConfig({ captureFormState: 'yes' }), /captureFormState/);
    assert.throws(() => resolveConfig({ metadata: 'yes' }), /metadata/);
    assert.throws(
      () => resolveConfig({ metadata: { siteUrl: 'pps.example' } }),
      /metadata\.siteUrl/,
    );
    assert.throws(
      () => resolveConfig({ metadata: { trailingSlash: 'sometimes' } }),
      /trailingSlash/,
    );
    assert.throws(
      () => resolveConfig({ browserDownloadHash: 'not-a-hash' }),
      /browserDownloadHash/,
    );
    assert.throws(() => resolveConfig({ browserDownloadHash: 'abc123' }), /browserDownloadHash/);
  });

  it('accepts the optimisation option shapes', () => {
    const config = resolveConfig({
      inlineCss: 'critical',
      saveAs: 'png',
      minifyHtml: { collapseWhitespace: false },
      minifyCss: {},
      userAgent: null,
      destination: 'out',
    });
    assert.equal(config.inlineCss, 'critical');
    assert.equal(config.saveAs, 'png');
    assert.deepEqual(config.minifyHtml, { collapseWhitespace: false });
    assert.equal(config.userAgent, null);
    assert.equal(config.destination, 'out');
    assert.equal(resolveConfig({ minifyHtml: true, minifyCss: true }).minifyHtml, true);
    const hash = 'a'.repeat(64);
    assert.equal(resolveConfig({ browserDownloadHash: hash }).browserDownloadHash, hash);
    assert.equal(resolveConfig({ metadata: { siteName: 'PPS' } }).metadata.siteName, 'PPS');
    assert.equal(resolveConfig({ metadata: null }).metadata, null);
  });

  it('normalises explicitly undefined optionals to null', () => {
    const config = resolveConfig({
      url: undefined,
      storageState: undefined,
      maxDepth: undefined,
      notFoundRoute: undefined,
    });
    assert.equal(config.url, null);
    assert.equal(config.storageState, null);
    assert.equal(config.maxDepth, null);
    assert.equal(config.notFoundRoute, null);
  });

  it('requires a url when a serve command is configured', () => {
    assert.throws(() => resolveConfig({ serveCmd: 'node server.js' }), /url is required/);
    const config = resolveConfig({ serveCmd: 'node server.js', url: 'http://127.0.0.1:3000' });
    assert.equal(config.serveCmd, 'node server.js');
  });
});

describe('isExecutablePath', () => {
  it('detects path-shaped browser options and rejects channel names', () => {
    assert.equal(isExecutablePath('/usr/bin/google-chrome'), true);
    assert.equal(isExecutablePath('C:\\Program Files\\Google\\Chrome\\chrome.exe'), true);
    assert.equal(isExecutablePath('chrome'), false);
    assert.equal(isExecutablePath('auto'), false);
    assert.equal(isExecutablePath(undefined), false);
  });
});
