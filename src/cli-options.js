/**
 * Translates parsed flags into prerender options, only including flags the user actually
 * passed so config-file values are never clobbered by defaults.
 * @param {{ values: object, positionals: string[] }} input
 * @returns {object}
 */
export function cliOptions({ values, positionals }) {
  const options = {};
  if (positionals[0] !== undefined) options.sourceDir = positionals[0];
  if (values.source !== undefined) options.sourceDir = values.source;
  if (values.base !== undefined) options.base = values.base;
  if (values.include !== undefined) options.include = splitList(values.include);
  if (values.exclude !== undefined) options.exclude = splitList(values.exclude);
  if (values['no-crawl']) options.crawl = false;
  if (values['max-depth'] !== undefined) options.maxDepth = Number(values['max-depth']);
  if (values['max-routes'] !== undefined) options.maxRoutes = Number(values['max-routes']);
  if (values.concurrency !== undefined) options.concurrency = Number(values.concurrency);
  if (values.timeout !== undefined) options.timeout = Number(values.timeout);
  if (values['quiet-period'] !== undefined) options.quietPeriod = Number(values['quiet-period']);
  if (values['scroll-step-delay'] !== undefined) {
    options.scrollStepDelay = Number(values['scroll-step-delay']);
  }
  if (values['max-cached-bytes'] !== undefined) {
    options.maxCachedBytes = Number(values['max-cached-bytes']);
  }
  if (values['serve-cmd-timeout'] !== undefined) {
    options.serveCmdTimeout = Number(values['serve-cmd-timeout']);
  }
  if (values['shutdown-timeout'] !== undefined) {
    options.shutdownTimeout = Number(values['shutdown-timeout']);
  }
  if (values.viewport !== undefined) {
    const match = /^(\d+)x(\d+)$/i.exec(values.viewport);
    if (!match) throw new Error('viewport must look like 1280x720');
    options.viewport = { width: Number(match[1]), height: Number(match[2]) };
  }
  if (values['ready-selector'] !== undefined) options.readySelector = values['ready-selector'];
  if (values['ready-flag'] !== undefined) options.readyFlag = values['ready-flag'];
  if (values.headless !== undefined) options.headless = values.headless;
  if (values['wait-for'] !== undefined) options.waitFor = values['wait-for'];
  if (values.browser !== undefined) options.browser = values.browser;
  if (values['no-browser-download']) options.browserDownload = false;
  if (values['browser-download-hash'] !== undefined) {
    options.browserDownloadHash = values['browser-download-hash'];
  }
  if (values['browser-download-version'] !== undefined) {
    options.browserDownloadVersion = values['browser-download-version'];
  }
  if (values['storage-state'] !== undefined) options.storageState = values['storage-state'];
  if (values['freeze-time'] !== undefined) {
    options.freezeTime = values['freeze-time'] === 'build' ? true : values['freeze-time'];
  }
  if (values.timezone !== undefined) options.timezone = values.timezone;
  if (values['random-seed'] !== undefined) options.randomSeed = Number(values['random-seed']);
  if (values['allow-rerender'] !== undefined || values['skip-hydration'] !== undefined) {
    options.hydration = {
      ...(values['allow-rerender'] !== undefined
        ? { allowRerender: splitList(values['allow-rerender']) }
        : {}),
      ...(values['skip-hydration'] !== undefined
        ? { skip: splitList(values['skip-hydration']) }
        : {}),
    };
  }
  const localeOptions = localeCliOptions(values);
  if (localeOptions) options.locales = localeOptions;
  const seoLocale = seoLocaleCliOptions(values);
  if (seoLocale) options.seoLocale = seoLocale;
  if (values['no-verify']) options.verify = false;
  if (values['verify-changed-only']) options.verifyChangedOnly = true;
  if (values['reuse-verification-context']) options.reuseVerificationContext = true;
  if (values['fail-on-hydration-error']) options.failOnHydrationError = true;
  if (values['fail-on-rerender']) options.failOnRerender = true;
  if (values['fail-on-page-error']) options.failOnPageError = true;
  if (values['fail-on-error'] !== undefined) options.failOnError = values['fail-on-error'];
  if (values['fail-on-empty-page'] !== undefined) {
    options.failOnEmptyPage = values['fail-on-empty-page'];
  }
  if (values['fail-on-console-error']) options.failOnConsoleError = true;
  if (values['fail-on-failed-request']) options.failOnFailedRequest = true;
  if (values['fail-on-duplicate-content']) options.failOnDuplicateContent = true;
  if (values['fail-on-build-origin-metadata']) options.failOnBuildOriginMetadata = true;
  if (values['fail-on-undetected']) options.failOnUndetected = true;
  if (values['fail-on-verification-error']) options.failOnVerificationError = true;
  if (values['no-block-third-party']) options.blockThirdParty = false;
  if (values['block-third-party']) options.blockThirdParty = true;
  if (values['allowed-hosts'] !== undefined)
    options.allowedHosts = splitList(values['allowed-hosts']);
  if (values['no-freeze-animations']) options.freezeAnimations = false;
  if (values['no-capture-runtime-styles']) options.captureRuntimeStyles = false;
  if (values['no-capture-form-state']) options.captureFormState = false;
  if (values.scroll) options.scrollToBottom = true;
  if (values.flat) options.flatOutput = true;
  if (values['not-found'] !== undefined) options.notFoundRoute = values['not-found'];
  if (values['routes-file'] !== undefined) options.routesFile = values['routes-file'];
  if (values['routes-from-sitemap'] !== undefined) {
    options.routesFromSitemap = values['routes-from-sitemap'];
  }
  if (values['route-priority'] !== undefined) {
    options.routePriority = splitList(values['route-priority']);
  }
  if (values.report !== undefined) options.reportPath = values.report;
  if (values.audit !== undefined) options.audit = values.audit;
  else if (values['no-audit']) options.audit = false;
  if (values['fail-on-audit-error']) options.failOnAuditError = true;
  if (values['audit-ignore-links'] !== undefined) {
    options.auditIgnoreLinks = splitList(values['audit-ignore-links']);
  }
  if (values['preload-links']) options.preloadLinks = true;
  if (values['image-sitemap']) options.imageSitemap = true;
  if (values.framework !== undefined) options.framework = values.framework;
  if (values.retries !== undefined) options.retries = Number(values.retries);
  if (values['retry-delay'] !== undefined) options.retryDelay = Number(values['retry-delay']);
  if (values['trace-on-error']) options.traceOnError = true;
  if (values.destination !== undefined) options.destination = values.destination;
  if (values['clean-destination']) options.cleanDestination = true;
  if (values['save-as'] !== undefined) options.saveAs = values['save-as'];
  if (values['user-agent'] !== undefined) options.userAgent = values['user-agent'];
  const metadata = metadataOptions(values);
  if (metadata) options.metadata = metadata;
  if (values['inline-css'] !== undefined) options.inlineCss = values['inline-css'];
  if (values.csp !== undefined) options.csp = values.csp;
  if (values['critical-css-preload'] !== undefined) {
    options.criticalCssPreload =
      values['critical-css-preload'] === 'none' ? false : values['critical-css-preload'];
  }
  if (values['minify-html']) options.minifyHtml = true;
  if (values['minify-css']) options.minifyCss = true;
  if (values['no-preconnect-third-party']) options.preconnectThirdParty = false;
  if (values['preconnect-third-party']) options.preconnectThirdParty = true;
  if (values['preload-images']) options.preloadImages = true;
  if (values['preload-manifest']) options.preloadManifest = true;
  if (values.sitemap) options.sitemap = true;
  if (values['ignore-for-preload'] !== undefined) {
    options.ignoreForPreload = splitList(values['ignore-for-preload']);
  }
  if (values['cache-ajax-requests']) options.cacheAjaxRequests = true;
  if (values['remove-scripts']) options.removeScriptTags = true;
  if (values['remove-styles']) options.removeStyleTags = true;
  if (values['async-scripts']) options.asyncScriptTags = true;
  if (values['external-scripts']) options.externalScripts = true;
  if (values['no-remove-blobs']) options.removeBlobs = false;
  if (values['remove-attributes'] !== undefined) {
    options.removeAttributes = splitList(values['remove-attributes']);
  }
  if (values['no-strip-build-origin-metadata']) options.stripBuildOriginMetadata = false;
  if (values['prune-stale-routes']) options.pruneStaleRoutes = true;
  if (values['ignore-https-errors']) options.ignoreHTTPSErrors = true;
  if (values['browser-args'] !== undefined) options.browserArgs = splitList(values['browser-args']);
  if (values.url !== undefined) options.url = values.url;
  if (values['serve-cmd'] !== undefined) options.serveCmd = values['serve-cmd'];
  if (values['dry-run']) options.dryRun = true;
  if (values['log-level'] !== undefined) options.logLevel = values['log-level'];
  return options;
}

// Splits comma separated flag values and drops empty entries.
function splitList(entries) {
  return entries.flatMap((entry) => entry.split(',')).filter((entry) => entry.length > 0);
}

// Parses repeatable code=value flags used by the locale matrix.
function parsePairs(entries) {
  const map = {};
  for (const entry of splitList(entries)) {
    const index = entry.indexOf('=');
    if (index <= 0) throw new Error('locale options must look like code=value');
    map[entry.slice(0, index)] = entry.slice(index + 1);
  }
  return map;
}

// Builds a locale matrix from the simple CLI flags. Full per-locale cookies, storage and
// translated slugs stay in a config file.
function localeCliOptions(values) {
  const enabled =
    values.locales !== undefined ||
    values['locale-mode'] !== undefined ||
    values['active-locale'] !== undefined;
  if (!enabled) return null;
  if (values.locales === undefined) throw new Error('--locales is required with locale flags');
  const codes = splitList([values.locales]);
  const defaultCode = values['default-locale'] ?? values['active-locale'] ?? codes[0];
  const mode = values['locale-mode'] ?? (values['active-locale'] ? 'single' : 'path');
  const prefixes = parsePairs(values['locale-prefix'] ?? []);
  const urls = parsePairs(values['locale-url'] ?? []);
  const states = parsePairs(values['locale-storage-state'] ?? []);
  return {
    mode,
    default: defaultCode,
    ...(values['active-locale'] ? { active: values['active-locale'] } : {}),
    hreflang: values['no-hreflang'] ? false : undefined,
    list: codes.map((code) => ({
      code,
      prefix: prefixes[code],
      url: urls[code],
      storageState: states[code],
    })),
  };
}

// Builds the optional SEO locale recipe from the CLI flags.
function seoLocaleCliOptions(values) {
  const enabled =
    values['seo-locale'] !== undefined ||
    values['seo-locale-source'] !== undefined ||
    values['seo-locale-key'] !== undefined ||
    values['seo-locale-cookie'] !== undefined ||
    values['no-seo-locale-inject'] ||
    values['no-seo-locale-verify'] ||
    values['no-seo-locale-render'] ||
    values['no-seo-locale-overwrite'] ||
    values['seo-locale-navigator'] ||
    values['seo-locale-force-html-lang'];
  if (!enabled) return null;
  return {
    ...(values['seo-locale'] ? { code: values['seo-locale'] } : {}),
    ...(values['seo-locale-source'] ? { source: values['seo-locale-source'] } : {}),
    ...(values['seo-locale-key'] ? { localStorageKey: values['seo-locale-key'] } : {}),
    ...(values['seo-locale-cookie'] ? { cookie: { name: values['seo-locale-cookie'] } } : {}),
    ...(values['no-seo-locale-inject'] ? { inject: false } : {}),
    ...(values['no-seo-locale-verify'] ? { seedVerification: false } : {}),
    ...(values['no-seo-locale-render'] ? { seedRender: false } : {}),
    ...(values['no-seo-locale-overwrite'] ? { overwrite: false } : {}),
    ...(values['seo-locale-navigator'] ? { navigator: true } : {}),
    ...(values['seo-locale-force-html-lang'] ? { forceHtmlLang: true } : {}),
  };
}

// Collects the metadata flags, or null when none was passed so a config file value survives.
function metadataOptions(values) {
  const metadata = {};
  if (values['metadata-site-url'] !== undefined) metadata.siteUrl = values['metadata-site-url'];
  if (values['metadata-site-name'] !== undefined) {
    metadata.siteName = values['metadata-site-name'];
  }
  if (values['metadata-title-template'] !== undefined) {
    metadata.titleTemplate = values['metadata-title-template'];
  }
  if (values['metadata-default-title'] !== undefined) {
    metadata.defaultTitle = values['metadata-default-title'];
  }
  if (values['metadata-default-image'] !== undefined) {
    metadata.defaultImage = values['metadata-default-image'];
  }
  if (values['metadata-trailing-slash'] !== undefined) {
    metadata.trailingSlash = values['metadata-trailing-slash'];
  }
  if (values['metadata-base'] !== undefined) metadata.base = values['metadata-base'];
  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Loads a JS config file. An explicitly requested file must exist; the implicit
 * snappy.config.js is optional. The default export is either a plain options object or an
 * async function that returns one, which is how routes are computed from a CMS, a sitemap or
 * a file listing without a separate prebuild script.
 */
