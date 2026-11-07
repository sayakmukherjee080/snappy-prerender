import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import {
  acquireIncrementalLock,
  addStorageStateToScope,
  hashFile,
  INCREMENTAL_CACHE_VERSION,
  INCREMENTAL_TOOL_VERSION,
  incrementalHtmlDir,
  incrementalScope,
  pruneIncrementalCache,
  readIncrementalCache,
  writeIncrementalCache,
} from './incremental-cache.js';
import { writeFileIfChanged } from './output.js';
import { toAppPath } from './resources.js';
import { DataRevalidator, dataRequestKey } from './revalidate.js';
import { resolveRouteConfig } from './route-config.js';
import { matchesPattern, normaliseRoute, toPublicPath } from './routes.js';

const PAGE_ORIGIN = 'http://snappy.local';

/**
 * Creates the per-run incremental controller. The controller owns the previous cache,
 * validates cached routes against current build inputs, revalidates recorded API data,
 * and writes a fresh cache after a clean run.
 */
export async function createIncrementalRun({ config, sourceDir, outputDir, cachePath, log }) {
  if (!config.incremental.enabled) return null;
  if (config.serveCmd || config.saveAs !== 'html') {
    log.warn('Incremental prerendering is disabled for this run');
    return null;
  }
  const lock = await acquireIncrementalLock(cachePath, {
    timeout: config.incremental.lockTimeout,
  });
  try {
    const previous = await readIncrementalCache(cachePath);
    const scope = await addStorageStateToScope(incrementalScope(config, sourceDir), config);
    const run = new IncrementalRun({
      config,
      sourceDir,
      outputDir,
      cachePath,
      previous,
      scope,
      log,
      lock,
    });
    await run.prepare();
    return run;
  } catch (error) {
    await lock.release().catch(() => {});
    throw error;
  }
}

/**
 * Resolves the source document a static server would use for a route: an exact route
 * file, a flat file, a directory index, or the SPA shell.
 * @param {{ sourceDir: string, route: string, notFoundRoute?: string | null }} input
 * @returns {Promise<string>}
 */
export async function resolveSourceFile({ sourceDir, route, notFoundRoute = null }) {
  const normalised = normaliseRoute(route);
  const notFound = notFoundRoute ? normaliseRoute(notFoundRoute) : null;
  const candidates = [];
  if (notFound && normalised === notFound) {
    candidates.push('404.html');
  } else if (normalised === '/') {
    candidates.push('index.html');
  } else {
    const relative = normalised.slice(1);
    candidates.push(path.posix.join(relative, 'index.html'));
    candidates.push(`${relative}.html`);
  }
  candidates.push('index.html');
  for (const candidate of candidates) {
    const file = path.join(sourceDir, candidate);
    const stats = await fs.stat(file).catch(() => null);
    if (stats?.isFile()) return candidate;
  }
  return 'index.html';
}

/**
 * Collects the local assets a written page references. Scripts and stylesheets are
 * content-hashed; images, fonts and other media only need an existence check because
 * their URL is already in the cached HTML.
 * @param {object} document
 * @param {{ base: string, route: string }} options
 * @returns {Map<string, string | null>}
 */
export function collectAssetDependencies(document, { base = '/', route = '/' } = {}) {
  const dependencies = new Map();
  const pageUrl = new URL(toPublicPath(route, base), PAGE_ORIGIN);

  const add = (value, hash) => {
    if (!value) return;
    let url;
    try {
      url = new URL(value, pageUrl);
    } catch {
      return;
    }
    if (url.origin !== PAGE_ORIGIN) return;
    const appPath = toAppPath(url.href, base);
    if (!appPath) return;
    const current = dependencies.get(appPath);
    if (hash || current === undefined) dependencies.set(appPath, hash ? 'hash' : null);
  };

  const walk = (node) => {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'script') add(attribute(node, 'src'), 'hash');
    if (tag === 'link') {
      const rel = attribute(node, 'rel').toLowerCase().split(/\s+/);
      const hash =
        rel.includes('stylesheet') ||
        rel.includes('modulepreload') ||
        (rel.includes('preload') && ['script', 'style'].includes(attribute(node, 'as')));
      add(attribute(node, 'href'), hash ? 'hash' : null);
    }
    if (tag === 'img') {
      add(attribute(node, 'src'), null);
      for (const candidate of parseSrcset(attribute(node, 'srcset'))) add(candidate, null);
    }
    if (tag === 'source') {
      add(attribute(node, 'src'), null);
      for (const candidate of parseSrcset(attribute(node, 'srcset'))) add(candidate, null);
    }
    if (tag === 'video') add(attribute(node, 'poster'), null);
    if (tag === 'style') {
      for (const candidate of cssUrls(textContent(node))) add(candidate, null);
    }
    const style = attribute(node, 'style');
    if (style) {
      for (const candidate of cssUrls(style)) add(candidate, null);
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
  return dependencies;
}

/**
 * The incremental controller. One instance exists per run and is discarded afterwards.
 */
class IncrementalRun {
  constructor({ config, sourceDir, outputDir, cachePath, previous, scope, log, lock }) {
    this.config = config;
    this.lock = lock;
    this.sourceDir = sourceDir;
    this.outputDir = outputDir;
    this.cachePath = cachePath;
    this.htmlDir = incrementalHtmlDir(cachePath);
    this.generatedDir = path.join(this.htmlDir, 'generated');
    this.vendorDir = path.join(this.htmlDir, 'vendor');
    this.previous = previous;
    this.previousVendorFiles = previous.cache?.vendorFiles ?? [];
    this.vendorManifest = new Map(Object.entries(previous.cache?.vendorManifest ?? {}));
    this.scope = scope;
    this.log = log;
    this.origin = null;
    this.revalidator = null;
    this.fileHashes = new Map();
    this.records = new Map();
    this.written = new Map();
    this.reused = new Map();
    this.verified = new Map();
    this.revalidatedKeys = new Set();
    this.usable = false;
    this.state = previous.state;
    this.stats = {
      reusedStatic: 0,
      reusedData: 0,
      rendered: 0,
      added: 0,
      excluded: 0,
      revalidated: 0,
      dataChanged: 0,
      dataFailed: 0,
      invalidated: {},
    };
  }

  /**
   * Decides whether the previous cache can be used at all. A missing, corrupt,
   * version-mismatched or scope-changed cache means a full render.
   */
  async prepare() {
    if (this.previous.state !== 'ok') {
      this.usable = false;
      this.state = this.previous.state;
      return;
    }
    if (this.previous.cache.scopeHash !== this.scope) {
      this.usable = false;
      this.state = 'scope-changed';
      return;
    }
    for (const record of this.previous.cache.routes ?? []) {
      if (record && typeof record.route === 'string') {
        this.records.set(record.route, record);
      }
    }
    this.usable = true;
    this.state = 'ready';
  }

  /**
   * Sets the current server origin used to replay same-origin API requests.
   * @param {string} origin
   */
  setOrigin(origin) {
    this.origin = origin;
  }

  /**
   * Returns a cached record when every build, output and data fingerprint matches.
   * @param {{ route: string, routeConfig: object }} input
   * @returns {Promise<object | null>}
   */
  async tryReuse({ route, routeConfig }) {
    if (!this.usable) return null;
    if (routeConfig.incremental === false) {
      this.stats.excluded += 1;
      return null;
    }
    if (this.config.incremental.exclude.some((pattern) => matchesPattern(route, pattern))) {
      this.stats.excluded += 1;
      return null;
    }
    const record = this.records.get(route);
    if (!record) {
      this.stats.added += 1;
      return null;
    }
    if (this.expired(record)) {
      this.invalidate('max-age');
      return null;
    }
    const sourceFile = await resolveSourceFile({
      sourceDir: this.sourceDir,
      route,
      notFoundRoute: this.config.notFoundRoute,
    });
    if (sourceFile !== record.sourceFile) {
      this.invalidate('source-file');
      return null;
    }
    const currentSourceHash = await this.hashSource(sourceFile);
    if (currentSourceHash !== record.sourceHash && currentSourceHash !== record.outputHash) {
      this.invalidate('source');
      return null;
    }
    if (this.config.verify && record.verified !== true) {
      this.invalidate('unverified');
      return null;
    }
    const assetReason = await this.checkAssets(record.assets ?? []);
    if (assetReason) {
      this.invalidate(assetReason);
      return null;
    }
    const cachedHtml = await this.readCachedHtml(record);
    if (cachedHtml === null) {
      this.invalidate('cache-html');
      return null;
    }
    const outputHash = await this.hashOutput(record.file.file);
    if (outputHash !== record.outputHash) {
      // A normal build replaces route files with their source HTML, or removes them.
      // That is a fresh build, not a modified cache entry.
      const sourceHash = await this.hashSource(record.sourceFile);
      if (outputHash !== null && outputHash !== sourceHash) {
        this.invalidate('output');
        return null;
      }
    }
    if ((record.dataRequests ?? []).length > 0) {
      if (this.config.incremental.mode !== 'trust') {
        const result = await this.validateData(record.dataRequests);
        if (!result.ok) {
          this.invalidate('data');
          return null;
        }
      }
    }
    if (!(await this.validateVendorAssets(record))) {
      this.invalidate('vendor-asset');
      return null;
    }
    return record;
  }

  /**
   * Captures a route's source document before any write can replace it.
   * @param {string} route
   */
  async recordSource(route) {
    const sourceFile = await resolveSourceFile({
      sourceDir: this.sourceDir,
      route,
      notFoundRoute: this.config.notFoundRoute,
    });
    this.written.set(route, {
      ...(this.written.get(route) ?? {}),
      sourceFile,
      sourceHash: await this.hashSource(sourceFile),
    });
  }

  /**
   * Records the render-time data requests and links for a fresh route.
   * @param {string} route
   * @param {object} result
   */
  recordRender(route, result) {
    this.written.set(route, {
      ...(this.written.get(route) ?? {}),
      dataRequests: result.dataRequests ?? [],
      dataUnverifiable: result.dataUnverifiable === true,
      links: result.links ?? [],
      extraAssets: [...(result.collector?.scripts ?? []), ...(result.collector?.styles ?? [])],
    });
  }

  /**
   * Records the final file detail and preload resources for a fresh route.
   * @param {string} route
   * @param {object} detail
   * @param {object | null} resources
   */
  recordWritten(route, detail, resources, vendorFailed = false) {
    this.written.set(route, {
      ...(this.written.get(route) ?? {}),
      detail,
      resources: resources ?? null,
      vendorFailed,
    });
  }

  /**
   * Marks a previous record as reused for this run.
   * @param {string} route
   * @param {object} record
   */
  recordReused(route, record) {
    this.reused.set(route, record);
    if (record.kind === 'data') this.stats.reusedData += 1;
    else this.stats.reusedStatic += 1;
  }

  /**
   * Records whether hydration verification accepted a fresh route.
   * @param {string} route
   * @param {boolean} ok
   */
  recordVerified(route, ok) {
    this.verified.set(route, ok === true);
  }

  /**
   * Builds the synthetic render result a cache hit returns to the crawl pipeline.
   * @param {object} record
   * @returns {object}
   */
  cachedResult(record) {
    return {
      route: record.route,
      links: record.links ?? [],
      pageErrors: [],
      consoleErrors: [],
      failedRequests: [],
      collector: null,
      dataRequests: record.dataRequests ?? [],
      dataUnverifiable: false,
      inlineCssSkipped: [],
      stateScript: null,
      screenshot: null,
      empty: false,
      statusCode: null,
      httpStatus: 200,
      finalUrl: null,
      attempts: 0,
      cached: record,
    };
  }

  /**
   * Returns the cached file record with a cached status for the report and artifacts.
   * @param {object} record
   * @returns {object}
   */
  cachedFile(record) {
    return { ...record.file, status: 'cached' };
  }

  /**
   * Returns the cached route detail with fresh verification defaults.
   * @param {object} record
   * @returns {object}
   */
  cachedDetail(record) {
    return {
      ...record.detail,
      status: 'cached',
      cached: true,
      cacheKind: record.kind,
      attempts: 0,
      httpStatus: 200,
      finalUrl: null,
      mode: null,
      framework: null,
      hydrationErrors: [],
      ignoredHydrationErrors: [],
      hydrationAllowed: false,
      pageErrors: [],
      consoleErrors: [],
      failedRequests: [],
      firstMismatch: null,
    };
  }

  /**
   * Returns the cached preload resources.
   * @param {object} record
   * @returns {object | null}
   */
  cachedResources(record) {
    return record.resources ?? null;
  }

  /**
   * Returns the vendor files the previous cache owns, so pruning keeps them on an
   * all-cached run.
   * @returns {object[]}
   */
  cachedVendorFiles() {
    return this.previousVendorFiles;
  }

  /**
   * Restores generated scripts (state and SEO locale) that cached pages reference.
   * They live outside dist because the build may wipe the output directory.
   * @param {object} report
   */
  async restoreGenerated(report) {
    if (!this.usable) return;
    for (const entry of this.previous.cache?.generatedFiles ?? []) {
      if (report.files.some((file) => file.file === entry.file)) continue;
      const source = path.join(this.generatedDir, entry.file);
      const contents = await fs.readFile(source).catch(() => null);
      if (contents === null) continue;
      const written = await writeFileIfChanged({
        dir: this.outputDir,
        file: entry.file,
        contents,
      });
      if (!report.files.some((file) => file.file === entry.file)) {
        report.files.push({
          route: null,
          file: entry.file,
          status: written.status === 'unchanged' ? 'cached' : written.status,
          bytes: contents.length,
        });
      }
    }
    for (const entry of this.previousVendorFiles) {
      if (report.files.some((file) => file.file === entry.file)) continue;
      const source = path.join(this.vendorDir, entry.file.slice('snappy-assets/'.length));
      const contents = await fs.readFile(source).catch(() => null);
      if (contents === null) continue;
      const written = await writeFileIfChanged({
        dir: this.outputDir,
        file: entry.file,
        contents,
      });
      if (!report.files.some((file) => file.file === entry.file)) {
        report.files.push({
          route: null,
          file: entry.file,
          status: written.status === 'unchanged' ? 'cached' : written.status,
          bytes: contents.length,
        });
      }
    }
  }

  /**
   * Restores a cached route's HTML into the current output directory after the crawl
   * has finished, so the static server never serves a restored page as the SPA shell.
   * @param {object} record
   * @returns {Promise<{ status: string }>}
   */
  async restoreRoute(record) {
    const html = await this.readCachedHtml(record);
    if (html === null) throw new Error(`incremental cache is missing HTML for ${record.route}`);
    const written = await writeFileIfChanged({
      dir: this.outputDir,
      file: record.file.file,
      contents: html,
    });
    return { status: written.status };
  }

  /**
   * Returns the previous asset summary for an all-cached run.
   * @returns {object | null}
   */
  cachedAssets() {
    return this.previous.cache?.assets ?? null;
  }

  /**
   * Writes the next cache after a clean run. A failed run keeps the previous cache so
   * the next attempt can still reuse it; a capped crawl caches the routes it accepted.
   * @param {{ report: object, dryRun: boolean }} input
   * @returns {Promise<object>}
   */
  async finalize({ report, dryRun }) {
    const summary = this.summary(report);
    if (dryRun || report.errors.length > 0) {
      summary.state = dryRun ? 'dry-run' : 'not-written';
      return summary;
    }
    const routes = [];
    for (const detail of report.routeDetails) {
      if (this.excluded(detail.route)) continue;
      const cached = this.reused.get(detail.route);
      if (cached) {
        routes.push(this.refreshCachedRecord(cached, detail));
        continue;
      }
      const written = this.written.get(detail.route);
      if (!written || !written.detail) continue;
      if (this.unsafe(detail, report)) continue;
      const sourceFile =
        written.sourceFile ??
        (await resolveSourceFile({
          sourceDir: this.sourceDir,
          route: detail.route,
          notFoundRoute: this.config.notFoundRoute,
        }));
      const sourceHash = written.sourceHash ?? (await this.hashSource(sourceFile));
      const assets = await this.assetDependencies(detail, written.extraAssets ?? []);
      if (written.dataUnverifiable || written.vendorFailed) continue;
      const outputHash = detail.htmlHash ?? (await this.hashOutput(detail.file));
      const htmlFile = `${outputHash}.html`;
      await this.storeHtml(htmlFile, detail.file);
      routes.push({
        route: detail.route,
        kind: (written.dataRequests ?? []).length > 0 ? 'data' : 'static',
        file: stripStatus(written.detail),
        detail: sanitizeDetail(written.detail),
        resources: written.resources,
        links: written.links ?? [],
        sourceFile,
        sourceHash,
        assets,
        outputHash,
        htmlFile,
        dataRequests: written.dataRequests ?? [],
        verified: this.verified.get(detail.route) === true,
        writtenAt: Date.now(),
      });
    }
    const cache = {
      version: INCREMENTAL_CACHE_VERSION,
      toolVersion: INCREMENTAL_TOOL_VERSION,
      generatedAt: new Date().toISOString(),
      scopeHash: this.scope,
      routes: routes.sort((left, right) => left.route.localeCompare(right.route)),
      generatedFiles: await this.storeGeneratedFiles(report),
      vendorFiles: await this.storeVendorFiles(report),
      vendorManifest: await this.readVendorManifest(),
      assets: report.assets ?? null,
    };
    const written = await writeIncrementalCache(this.cachePath, cache);
    await this.pruneCache(cache, report);
    summary.state = written.status;
    summary.routes = routes.length;
    return summary;
  }

  /**
   * Produces the public report section.
   * @param {object} report
   * @returns {object}
   */
  summary(report) {
    const invalidated = Object.entries(this.stats.invalidated).map(([reason, count]) => ({
      reason,
      count,
    }));
    return {
      enabled: true,
      mode: this.config.incremental.mode,
      cacheFile: this.cachePath,
      maxAge: this.config.incremental.maxAge,
      state: this.state,
      reusedStatic: this.stats.reusedStatic,
      reusedData: this.stats.reusedData,
      rendered: report.routeDetails.filter((detail) => detail.status !== 'cached').length,
      added: this.stats.added,
      excluded: this.stats.excluded,
      revalidated: this.stats.revalidated,
      dataChanged: this.stats.dataChanged,
      dataFailed: this.stats.dataFailed,
      invalidated,
    };
  }

  /**
   * Releases the revalidation request context and the cache lock. The lock stays
   * held for the whole run so a second build cannot prune or overwrite cache files.
   */
  async close() {
    try {
      if (this.revalidator) await this.revalidator.close();
    } finally {
      if (this.lock) await this.lock.release().catch(() => false);
    }
  }

  // Checks whether a record is older than the configured maxAge.
  expired(record) {
    const maxAge = this.config.incremental.maxAge;
    if (maxAge === null) return false;
    if (!Number.isFinite(record.writtenAt)) return true;
    return Date.now() - record.writtenAt > maxAge;
  }

  // Revalidates the external sources of local snappy-assets files used by a route.
  async validateVendorAssets(record) {
    const usesVendorAssets = (record.assets ?? []).some((asset) =>
      asset.path.startsWith('/snappy-assets/'),
    );
    if (!usesVendorAssets) return true;
    if (this.config.incremental.mode === 'trust') return true;
    if (this.vendorManifest.size === 0) return false;
    const requests = [];
    for (const entry of this.vendorManifest.values()) {
      requests.push({
        method: 'GET',
        url: entry.url,
        sameOrigin: false,
        accept: '',
        requestContentType: '',
        status: 200,
        etag: null,
        lastModified: null,
        bodyHash: entry.hash,
        bytes: entry.bytes ?? 0,
        unverifiable: false,
        reason: null,
        key: dataRequestKey({ method: 'GET', url: entry.url }),
      });
    }
    const result = await this.validateData(requests);
    return result.ok;
  }

  // Revalidates a route's data requests and updates counters.
  async validateData(requests) {
    this.revalidator ??= new DataRevalidator({
      config: this.config,
      origin: this.origin,
      log: this.log,
    });
    for (const request of requests) {
      if (this.revalidatedKeys.has(request.key)) continue;
      this.revalidatedKeys.add(request.key);
      this.stats.revalidated += 1;
    }
    const result = await this.revalidator.validate(requests);
    if (!result.ok) {
      if (/changed|differs/.test(result.reason ?? '')) this.stats.dataChanged += 1;
      else this.stats.dataFailed += 1;
    }
    return result;
  }

  // Reads and verifies the cached HTML for a route.
  async readCachedHtml(record) {
    if (!record.htmlFile) return null;
    const file = path.join(this.htmlDir, record.htmlFile);
    const html = await fs.readFile(file, 'utf8').catch(() => null);
    if (html === null) return null;
    const hash = createHash('sha256').update(html).digest('hex');
    return hash === record.outputHash ? html : null;
  }

  // Hashes a source document, memoised for the run.
  hashSource(file) {
    return this.hashPath(path.join(this.sourceDir, file));
  }

  // Hashes one output file, memoised for the run.
  hashOutput(file) {
    return this.hashPath(path.join(this.outputDir, file));
  }

  // Memoises file hashes by absolute path.
  hashPath(file) {
    if (this.fileHashes.has(file)) return this.fileHashes.get(file);
    const promise = hashFile(file);
    this.fileHashes.set(file, promise);
    return promise;
  }

  // Checks the cached asset list against the current output tree.
  async checkAssets(assets) {
    for (const asset of assets) {
      const appPath = asset.path.startsWith('/') ? asset.path.slice(1) : asset.path;
      const generated = appPath.startsWith('snappy/') || appPath.startsWith('snappy-seo-locale-');
      const vendor = appPath.startsWith('snappy-assets/');
      const file = generated
        ? path.join(this.generatedDir, appPath)
        : vendor
          ? path.join(this.vendorDir, appPath.slice('snappy-assets/'.length))
          : safeOutputPath(this.outputDir, asset.path);
      if (!file) return 'asset-path';
      const exists = await fs.stat(file).catch(() => null);
      if (!exists?.isFile()) return 'asset-missing';
      if (asset.hash) {
        const current = await this.hashPath(file);
        if (current !== asset.hash) return 'asset-changed';
      }
    }
    return null;
  }

  // Builds the asset dependency list from the written page.
  async assetDependencies(detail, extraAssets = []) {
    const file = path.join(this.outputDir, detail.file);
    const html = await fs.readFile(file, 'utf8').catch(() => null);
    if (html === null) return [];
    const document = parse(html);
    const dependencies = collectAssetDependencies(document, {
      base: this.config.base,
      route: detail.route,
    });
    for (const assetPath of extraAssets) {
      if (!assetPath || assetPath.startsWith('http')) continue;
      dependencies.set(assetPath, 'hash');
    }
    const assets = [];
    for (const [assetPath, hash] of [...dependencies.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const filePath = safeOutputPath(this.outputDir, assetPath);
      if (!filePath) continue;
      assets.push({
        path: assetPath,
        hash: hash ? await this.hashPath(filePath) : null,
      });
    }
    return assets;
  }

  // Carries a reused record forward, refreshing context-dependent detail fields.
  refreshCachedRecord(record, detail) {
    return {
      ...record,
      detail: sanitizeDetail({ ...record.detail, ...detail }),
      file: stripStatus({ ...record.file, ...detail }),
      verified: record.verified === true || this.verified.get(record.route) === true,
    };
  }

  // Records an invalidation reason.
  invalidate(reason) {
    this.stats.invalidated[reason] = (this.stats.invalidated[reason] ?? 0) + 1;
  }

  // Removes cached pages, generated scripts and vendored assets that the fresh
  // cache and the current report no longer reference.
  async pruneCache(cache, report) {
    const keepHtml = new Set();
    const keepGenerated = new Set();
    const keepVendor = new Set();
    for (const route of cache.routes) {
      if (route.htmlFile) keepHtml.add(route.htmlFile);
    }
    for (const entry of cache.generatedFiles) {
      if (entry.file) keepGenerated.add(entry.file);
    }
    for (const entry of cache.vendorFiles) {
      if (entry.file) keepVendor.add(entry.file.slice('snappy-assets/'.length));
    }
    for (const entry of report.files) {
      if (!entry.file) continue;
      if (entry.file.startsWith('snappy/') || entry.file.startsWith('snappy-seo-locale-')) {
        keepGenerated.add(entry.file);
      } else if (entry.file.startsWith('snappy-assets/')) {
        keepVendor.add(entry.file.slice('snappy-assets/'.length));
      }
    }
    await pruneIncrementalCache({
      cachePath: this.cachePath,
      keepHtml,
      keepGenerated,
      keepVendor,
    });
  }

  // Copies vendored assets into the cache directory so a build can wipe dist.
  async storeVendorFiles(report) {
    const files = [];
    for (const entry of report.files) {
      if (!entry.file?.startsWith('snappy-assets/')) continue;
      const contents = await fs.readFile(path.join(this.outputDir, entry.file)).catch(() => null);
      if (contents === null) continue;
      await writeFileIfChanged({
        dir: this.vendorDir,
        file: entry.file.slice('snappy-assets/'.length),
        contents,
      });
      files.push({ file: entry.file, bytes: contents.length });
    }
    return files.sort((left, right) => left.file.localeCompare(right.file));
  }

  // Copies generated scripts into the cache directory for an all-cached run.
  async storeGeneratedFiles(report) {
    const files = [];
    for (const entry of report.files) {
      if (!entry.file) continue;
      if (!entry.file.startsWith('snappy/') && !entry.file.startsWith('snappy-seo-locale-')) {
        continue;
      }
      const contents = await fs.readFile(path.join(this.outputDir, entry.file)).catch(() => null);
      if (contents === null) continue;
      await writeFileIfChanged({
        dir: this.generatedDir,
        file: entry.file,
        contents,
      });
      files.push({ file: entry.file, bytes: contents.length });
    }
    return files.sort((left, right) => left.file.localeCompare(right.file));
  }

  // Copies a written page into the cache directory so a later build can restore it.
  async storeHtml(htmlFile, outputFile) {
    const target = path.join(this.outputDir, outputFile);
    const html = await fs.readFile(target).catch(() => null);
    if (html === null) return;
    await writeFileIfChanged({
      dir: this.htmlDir,
      file: htmlFile,
      contents: html,
    });
  }

  // Reads the vendor manifest into app-relative keys for cache validation.
  async readVendorManifest() {
    const file = path.join(this.outputDir, 'snappy-assets', 'manifest.json');
    const contents = await fs.readFile(file, 'utf8').catch(() => null);
    if (contents === null) return {};
    let entries;
    try {
      entries = JSON.parse(contents);
    } catch {
      return {};
    }
    const manifest = {};
    for (const entry of entries) {
      const appPath = toAppPath(new URL(entry.local, PAGE_ORIGIN).href, this.config.base);
      if (!appPath) continue;
      manifest[appPath] = {
        url: entry.url,
        hash: entry.sourceHash ?? entry.hash,
        bytes: entry.bytes ?? 0,
      };
    }
    for (const [appPath, entry] of Object.entries(this.previous.cache?.vendorManifest ?? {})) {
      if (!manifest[appPath]) manifest[appPath] = entry;
    }
    return manifest;
  }

  // Reports whether a route is deliberately excluded from reuse.
  excluded(route) {
    if (this.config.incremental.exclude.some((pattern) => matchesPattern(route, pattern))) {
      return true;
    }
    return resolveRouteConfig(this.config, route).incremental === false;
  }

  // Excludes routes with page-level failures from the next cache.
  unsafe(detail, report) {
    if (detail.empty) return true;
    if ((detail.pageErrors ?? []).length > 0) return true;
    if ((detail.failedRequests ?? []).some((failure) => !isGeneratedFile(failure.url))) {
      return true;
    }
    if (report.emptyPages.includes(detail.route)) return true;
    return report.pageErrors.some((entry) => entry.route === detail.route);
  }
}

// Returns the subset of a route detail that can safely be reused.
function sanitizeDetail(detail) {
  return {
    route: detail.route,
    locale: detail.locale ?? null,
    order: detail.order ?? null,
    file: detail.file,
    bytes: detail.bytes ?? 0,
    htmlHash: detail.htmlHash ?? null,
    contentHash: detail.contentHash ?? null,
    textLength: detail.textLength ?? null,
    lastmod: detail.lastmod ?? null,
    depth: detail.depth ?? null,
    notFound: detail.notFound === true,
    noindex: detail.noindex === true,
    meta: detail.meta ?? null,
    images: detail.images ?? [],
    alternates: detail.alternates ?? [],
    localeUrl: detail.localeUrl ?? null,
    inlineStyleAttributes: detail.inlineStyleAttributes ?? 0,
    buildOriginUrls: detail.buildOriginUrls ?? [],
  };
}

// Removes the runtime status from a stored file detail.
function stripStatus(file) {
  return Object.fromEntries(Object.entries(file).filter(([key]) => key !== 'status'));
}

// Resolves an app path to a path inside the output directory, refusing traversal.
function safeOutputPath(outputDir, appPath) {
  const root = path.resolve(outputDir);
  const target = path.resolve(root, `.${appPath.startsWith('/') ? appPath : `/${appPath}`}`);
  return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
}

// Reads one attribute value.
function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

// Concatenates text beneath a node, skipping scripts and styles.
function textContent(node) {
  let text = '';
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') text += child.value;
    else if (!['SCRIPT', 'STYLE'].includes(child.tagName?.toUpperCase())) {
      text += textContent(child);
    }
  }
  return text;
}

// Extracts url(...) candidates from CSS text.
function cssUrls(css) {
  const urls = [];
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
    const value = match[2].trim();
    if (value && !value.startsWith('data:') && !value.startsWith('#')) urls.push(value);
  }
  return urls;
}

// Generated scripts are written after capture, so their first-load 404 is expected.
function isGeneratedFile(url) {
  return /\/(?:snappy\/state-[^/]+\.js|snappy-seo-locale-[^/]+\.js)(?:[?#].*)?$/.test(String(url));
}

// Parses srcset into URLs, ignoring descriptors.
function parseSrcset(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}
