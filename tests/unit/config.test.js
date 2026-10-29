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
    assert.equal(resolveConfig({ include: ['/'] }).includeProvided, false);
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
    assert.throws(() => resolveConfig({ maxCachedBytes: 0 }), /maxCachedBytes/);
    assert.throws(() => resolveConfig({ maxCachedBytes: -1 }), /maxCachedBytes/);
    assert.throws(() => resolveConfig({ removeAttributes: [42] }), /removeAttributes/);
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

  it('validates metadata keys, base and template', () => {
    assert.throws(() => resolveConfig({ metadata: { base: 'app' } }), /metadata\.base/);
    assert.throws(
      () => resolveConfig({ metadata: { siteURL: 'https://x.example' } }),
      /metadata\.siteURL/,
    );
    assert.equal(resolveConfig({ metadata: { base: '/app/' } }).metadata.base, '/app/');
    assert.throws(
      () => resolveConfig({ metadata: { siteUrl: 'https://x.example/app' } }),
      /origin without a path/,
    );

    const warned = resolveConfig({ metadata: { titleTemplate: 'Example' } });
    assert.equal(
      warned.warnings.some((message) => message.includes('titleTemplate')),
      true,
    );
    assert.deepEqual(resolveConfig({}).warnings, []);
  });

  it('validates every boolean option, not a hand-picked subset', () => {
    for (const key of [
      'crawl',
      'headless',
      'verify',
      'failOnHydrationError',
      'failOnPageError',
      'failOnRerender',
      'flatOutput',
      'dryRun',
      'externalScripts',
      'sitemap',
      'verifyChangedOnly',
    ]) {
      assert.throws(() => resolveConfig({ [key]: 'yes' }), new RegExp(key));
    }
    assert.equal(resolveConfig({ failOnPageError: true }).failOnPageError, true);
  });

  it('requires a public site URL for the sitemap', () => {
    assert.throws(() => resolveConfig({ sitemap: true }), /sitemap/);
    assert.equal(
      resolveConfig({ sitemap: true, metadata: { siteUrl: 'https://example.com' } }).sitemap,
      true,
    );
    assert.equal(resolveConfig({ sitemap: false }).sitemap, false);
  });

  it('validates the critical CSS preload choice', () => {
    assert.throws(() => resolveConfig({ criticalCssPreload: 'sometimes' }), /criticalCssPreload/);
    assert.equal(resolveConfig({ criticalCssPreload: false }).criticalCssPreload, false);
    assert.equal(resolveConfig({ criticalCssPreload: 'body' }).criticalCssPreload, 'body');
    assert.equal(resolveConfig({}).criticalCssPreload, 'media');
  });

  it('derives the script-delivery defaults from the CSP dial', () => {
    const off = resolveConfig({});
    assert.equal(off.csp, 'off');
    assert.equal(off.externalScripts, false);
    assert.equal(off.criticalCssPreload, 'media');

    const strict = resolveConfig({ csp: 'strict' });
    assert.equal(strict.externalScripts, true);
    assert.equal(strict.criticalCssPreload, false);

    // Explicit options still win over the dial, so one part can be put back.
    const tuned = resolveConfig({
      csp: 'strict',
      externalScripts: false,
      criticalCssPreload: 'body',
    });
    assert.equal(tuned.externalScripts, false);
    assert.equal(tuned.criticalCssPreload, 'body');

    assert.throws(() => resolveConfig({ csp: 'sometimes' }), /csp/);
  });

  it('freezes the nested viewport defaults', () => {
    assert.throws(() => {
      DEFAULTS.viewport.width = 1;
    }, TypeError);
  });

  it('freezes the list defaults so one run cannot change another', () => {
    assert.throws(() => {
      DEFAULTS.include.push('/mutated');
    }, TypeError);
    assert.throws(() => {
      DEFAULTS.allowedHosts.push('mutated.example');
    }, TypeError);
  });

  it('warns about unknown option names instead of silently ignoring them', () => {
    const config = resolveConfig({ inlineCSS: 'inline' });
    assert.match(config.warnings.join('\n'), /unknown option "inlineCSS"/);
  });

  it('warns when metadata.base differs from the routing base', () => {
    const config = resolveConfig({ base: '/app/', metadata: { base: '/other/' } });
    assert.match(config.warnings.join('\n'), /metadata\.base/);
  });

  it('validates a pinned browser download version', () => {
    assert.equal(
      resolveConfig({ browserDownloadVersion: '131.0.6778.85' }).browserDownloadVersion,
      '131.0.6778.85',
    );
    assert.throws(() => resolveConfig({ browserDownloadVersion: 42 }), /browserDownloadVersion/);
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
    assert.throws(
      () =>
        resolveConfig({
          serveCmd: 'node server.js',
          url: 'http://127.0.0.1:3000/app',
        }),
      /origin without a path/,
    );
  });

  it('rejects a style strip that would remove inlined CSS', () => {
    assert.throws(
      () => resolveConfig({ inlineCss: 'inline', removeStyleTags: true }),
      /removeStyleTags cannot be combined/,
    );
    assert.equal(
      resolveConfig({ inlineCss: 'critical', removeStyleTags: true }).removeStyleTags,
      true,
    );
  });

  it('warns when a gate or optimisation has no effect', () => {
    const config = resolveConfig({
      verify: false,
      failOnHydrationError: true,
      criticalCssPreload: 'body',
      minifyCss: true,
      allowedHosts: ['api.example.com'],
    });
    const warnings = config.warnings.join('\n');
    assert.match(warnings, /failOnHydrationError has no effect/);
    assert.match(warnings, /criticalCssPreload has no effect/);
    assert.match(warnings, /minifyCss has no effect/);
    assert.match(warnings, /allowedHosts has no effect/);
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

describe('resolveConfig 2.7 options', () => {
  it('applies the report, audit and output defaults', () => {
    const config = resolveConfig();
    assert.equal(config.audit, true);
    assert.equal(config.failOnAuditError, false);
    assert.deepEqual(config.auditIgnoreLinks, []);
    assert.equal(config.reportPath, null);
    assert.deepEqual(config.routePriority, []);
    assert.deepEqual(config.routeOverrides, []);
    assert.equal(config.transformHtml, null);
    assert.equal(config.routesFile, null);
    assert.equal(config.routesFromSitemap, null);
    assert.equal(config.preloadLinks, false);
    assert.equal(config.imageSitemap, false);
    assert.equal(config.framework, 'auto');
    assert.equal(config.retries, 0);
    assert.equal(config.retryDelay, 500);
    assert.equal(config.traceOnError, false);
  });

  it('makes hash mode imply external scripts and no preload swap handler', () => {
    const config = resolveConfig({ csp: 'hash' });
    assert.equal(config.externalScripts, true);
    assert.equal(config.criticalCssPreload, false);

    const overridden = resolveConfig({
      csp: 'hash',
      externalScripts: false,
      criticalCssPreload: 'media',
    });
    assert.equal(overridden.externalScripts, false);
    assert.equal(overridden.criticalCssPreload, 'media');
  });

  it('accepts a transform function and rejects any other value', () => {
    const transform = (html) => html;
    assert.equal(resolveConfig({ transformHtml: transform }).transformHtml, transform);
    assert.throws(
      () => resolveConfig({ transformHtml: 'nope' }),
      /transformHtml must be a function/,
    );
  });

  it('validates retry counts and delays', () => {
    assert.equal(resolveConfig({ retries: 2, retryDelay: 10 }).retries, 2);
    assert.throws(() => resolveConfig({ retries: -1 }), /retries/);
    assert.throws(() => resolveConfig({ retries: 1.5 }), /retries/);
    assert.throws(() => resolveConfig({ retryDelay: 0 }), /retryDelay/);
  });

  it('validates the framework choice', () => {
    assert.equal(resolveConfig({ framework: 'vue' }).framework, 'vue');
    assert.throws(() => resolveConfig({ framework: 'angular' }), /framework must be one of/);
  });

  it('validates route priority and audit ignore patterns', () => {
    assert.deepEqual(resolveConfig({ routePriority: ['/', /^\/product/] }).routePriority, [
      '/',
      /^\/product/,
    ]);
    assert.throws(() => resolveConfig({ routePriority: [42] }), /routePriority/);
    assert.throws(() => resolveConfig({ auditIgnoreLinks: [42] }), /auditIgnoreLinks/);
  });

  it('warns that a preload swap handler is blocked under hash mode', () => {
    const config = resolveConfig({ csp: 'hash', criticalCssPreload: 'media' });
    assert.match(config.warnings.join('\n'), /inline onload handler/);
  });

  it('warns when a new option cannot take effect', () => {
    const config = resolveConfig({
      audit: false,
      failOnAuditError: true,
      auditIgnoreLinks: ['/api/*'],
      verify: false,
      framework: 'vue',
      preloadLinks: true,
      removeScriptTags: true,
      saveAs: 'png',
      imageSitemap: true,
      sitemap: false,
      traceOnError: true,
      dryRun: true,
    });
    const warnings = config.warnings.join('\n');
    assert.match(warnings, /failOnAuditError has no effect/);
    assert.match(warnings, /auditIgnoreLinks has no effect/);
    assert.match(warnings, /framework has no effect/);
    assert.match(warnings, /preloadLinks has no effect/);
    assert.match(warnings, /preloadLinks skips script hints/);
    assert.match(warnings, /imageSitemap has no effect/);
    assert.match(warnings, /traceOnError has no effect/);
  });
});
