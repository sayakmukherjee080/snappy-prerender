/**
 * Reports options that do nothing in the current combination, so a build does not
 * quietly skip a gate the caller believes is active.
 * @param {object} config
 * @param {object} userOptions
 * @param {object} defaults
 */
export function addConfigWarnings(config, userOptions, defaults) {
  const warn = (message) => config.warnings.push(message);
  for (const key of Object.keys(userOptions)) {
    if (!Object.hasOwn(defaults, key)) {
      warn(`unknown option "${key}" is ignored; check the spelling`);
    }
  }
  if (!config.verify) {
    for (const key of [
      'verifyChangedOnly',
      'failOnHydrationError',
      'failOnRerender',
      'failOnUndetected',
      'failOnVerificationError',
    ]) {
      if (config[key]) warn(`${key} has no effect because verify is false`);
    }
  }
  if (config.verify && (config.serveCmd || config.saveAs !== 'html')) {
    for (const key of [
      'failOnHydrationError',
      'failOnRerender',
      'failOnUndetected',
      'failOnVerificationError',
    ]) {
      if (config[key]) {
        warn(
          `${key} has no effect because hydration verification is skipped with ${config.serveCmd ? 'serveCmd' : `saveAs: '${config.saveAs}'`}`,
        );
      }
    }
    if (userOptions.framework !== undefined) {
      warn(
        `framework has no effect because hydration verification is skipped with ${config.serveCmd ? 'serveCmd' : `saveAs: '${config.saveAs}'`}`,
      );
    }
  }
  if (!config.verify && userOptions.framework !== undefined) {
    warn('framework has no effect because verify is false');
  }
  if (!config.verify && config.reuseVerificationContext) {
    warn('reuseVerificationContext has no effect because verify is false');
  }
  if (config.reuseVerificationContext && config.storageState) {
    warn(
      'reuseVerificationContext shares browser storage across routes; authenticated routes may see state from another route',
    );
  }
  if (!config.audit && config.failOnAuditError) {
    warn('failOnAuditError has no effect because audit is false');
  }
  if (!config.audit && config.auditIgnoreLinks.length > 0) {
    warn('auditIgnoreLinks has no effect because audit is false');
  }
  if (config.preloadLinks && config.saveAs !== 'html') {
    warn(`preloadLinks has no effect when saveAs is '${config.saveAs}'`);
  }
  if (config.preloadLinks && config.removeScriptTags) {
    warn('preloadLinks skips script hints because removeScriptTags strips every script');
  }
  if (config.imageSitemap && !config.sitemap) {
    warn('imageSitemap has no effect because sitemap is false');
  }
  if (config.traceOnError && config.dryRun) {
    warn('traceOnError has no effect in dry-run mode');
  }
  if (
    userOptions.criticalCssPreload !== undefined &&
    config.criticalCssPreload !== false &&
    config.inlineCss !== 'critical'
  ) {
    warn('criticalCssPreload has no effect unless inlineCss is "critical"');
  }
  if (config.minifyCss && !config.minifyHtml && !config.inlineCss) {
    warn('minifyCss has no effect unless minifyHtml or inlineCss is enabled');
  }
  if (config.allowedHosts.length > 0 && !config.blockThirdParty) {
    warn('allowedHosts has no effect unless blockThirdParty is true');
  }
  if (config.csp === 'strict' && config.inlineCss) {
    warn(
      "csp controls script-src; inlineCss emits inline styles, which need style-src 'unsafe-inline' or hashes",
    );
  }
  if (
    (config.csp === 'strict' || config.csp === 'hash') &&
    userOptions.criticalCssPreload !== undefined &&
    config.criticalCssPreload !== false
  ) {
    warn(
      "criticalCssPreload emits an inline onload handler that a script-src 'self' policy blocks",
    );
  }
  if (config.removeStyleTags && config.inlineCss === 'critical') {
    warn('removeStyleTags removes CSS-in-JS styles before critical CSS is extracted');
  }
  if (config.sitemap && config.saveAs !== 'html') {
    warn(`sitemap has no effect when saveAs is '${config.saveAs}'`);
  }
  if (config.freezeTime && config.verifyChangedOnly) {
    warn(
      'freezeTime with verifyChangedOnly makes output timestamps vary per run; use an explicit ISO time or SOURCE_DATE_EPOCH for stable files',
    );
  }
  if (config.reuseVerificationContext && (config.locales || config.seoLocale)) {
    warn(
      'reuseVerificationContext is ignored when locales or seoLocale change the browser context between routes',
    );
  }
  if (config.locales?.mode === 'path' && config.seoLocale?.code) {
    warn('seoLocale.code is ignored in path mode; each locale supplies its own code');
  }
  if (config.locales?.mode === 'path' && config.locales.active) {
    warn('locales.active is ignored in path mode; each route supplies its own locale');
  }
  if (config.seoLocale && config.seoLocale.inject === false) {
    warn(
      'seoLocale.inject is false: the generated locale is in the HTML, but visitors with different storage may see another locale after hydration',
    );
  }
  if (config.seoLocale?.overwrite === false && config.storageState) {
    warn(
      'seoLocale.overwrite is false with storageState: an existing locale value may win and the rendered locale may differ',
    );
  }
  if (config.seoLocale?.cookie?.secure && config.metadata?.siteUrl?.startsWith('http://')) {
    warn(
      'seoLocale.cookie.secure is true while metadata.siteUrl is HTTP; preview browsers will not set the cookie',
    );
  }
  if (
    config.seoLocale?.cookie?.sameSite?.toLowerCase() === 'none' &&
    !config.seoLocale.cookie.secure
  ) {
    warn('seoLocale.cookie.sameSite is None without Secure; browsers reject that cookie');
  }
  const metadataBase = config.metadata?.base;
  if (metadataBase && metadataBase !== config.base) {
    warn(
      `metadata.base (${metadataBase}) differs from base (${config.base}); canonical, social URLs and routing will disagree`,
    );
  }
}
