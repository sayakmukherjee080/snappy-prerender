import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeFileIfChanged } from './output.js';

export const INCREMENTAL_CACHE_VERSION = 1;
export const INCREMENTAL_CACHE_FILE = '.snappy-cache.json';
export const INCREMENTAL_LOCK_STALE_MS = 6 * 60 * 60 * 1000;
const INCREMENTAL_LOCK_POLL_MS = 100;

/**
 * Reports a cache that another build owns. The build fails instead of writing a
 * second cache beside the running one.
 */
export class IncrementalCacheLockError extends Error {
  constructor(message, { cachePath, owner }) {
    super(message);
    this.name = 'IncrementalCacheLockError';
    this.code = 'INCREMENTAL_CACHE_LOCKED';
    this.cachePath = cachePath;
    this.owner = owner;
  }
}

/**
 * Returns the lock file that guards a cache path.
 * @param {string} cachePath
 * @returns {string}
 */
export function incrementalLockFile(cachePath) {
  return `${cachePath}.lock`;
}

/**
 * Acquires the cache lock, reclaiming a lock whose owner process is gone or whose
 * timestamp is older than the stale threshold. With a positive timeout the call
 * waits for the current owner instead of failing immediately.
 * @param {string} cachePath
 * @param {{ timeout?: number, staleAfter?: number }} [options]
 * @returns {Promise<{ file: string, token: string, release: () => Promise<boolean> }>}
 */
export async function acquireIncrementalLock(
  cachePath,
  { timeout = 0, staleAfter = INCREMENTAL_LOCK_STALE_MS } = {},
) {
  const file = incrementalLockFile(cachePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const token = randomUUID();
  const deadline = Date.now() + timeout;
  let owner = null;
  for (;;) {
    owner = await inspectIncrementalLock(file, staleAfter);
    if (owner === null || owner.stale) {
      if (owner !== null) await fs.rm(file, { force: true }).catch(() => {});
      if (await createIncrementalLock(file, token)) {
        return {
          file,
          token,
          release: () => releaseIncrementalLock(file, token),
        };
      }
      continue;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new IncrementalCacheLockError(
        `incremental cache is locked by another build (pid ${owner.pid ?? 'unknown'}): ${file}. Wait for it to finish, raise incremental.lockTimeout, or delete the lock file if that process is gone.`,
        { cachePath, owner },
      );
    }
    await delay(Math.min(INCREMENTAL_LOCK_POLL_MS, remaining));
  }
}

/**
 * Releases a lock only when it still belongs to the caller, so a reclaimed stale
 * lock owned by another build is never removed by the previous owner.
 * @param {string} file
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function releaseIncrementalLock(file, token) {
  const contents = await fs.readFile(file, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (contents === null) return false;
  let owner;
  try {
    owner = JSON.parse(contents);
  } catch {
    return false;
  }
  if (!owner || owner.token !== token) return false;
  await fs.rm(file, { force: true });
  return true;
}

/**
 * Returns the directory that stores reusable HTML beside the cache file. Keeping the
 * pages outside dist lets a normal build wipe dist without losing the cache.
 * @param {string} cachePath
 * @returns {string}
 */
export function incrementalHtmlDir(cachePath) {
  const parsed = path.parse(cachePath);
  return path.join(parsed.dir, `${parsed.name}-files`);
}

export const INCREMENTAL_TOOL_VERSION = JSON.parse(
  await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
).version;
const TOOL_VERSION = INCREMENTAL_TOOL_VERSION;

/**
 * Reads the incremental cache. A missing, malformed or version-mismatched file is a
 * normal first-run state and disables reuse instead of failing the build.
 * @param {string} file
 * @returns {Promise<{ state: string, cache: object | null }>}
 */
export async function readIncrementalCache(file) {
  if (!file) return { state: 'missing', cache: null };
  let contents;
  try {
    contents = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'missing', cache: null };
    return { state: 'invalid', cache: null };
  }
  let cache;
  try {
    cache = JSON.parse(contents);
  } catch {
    return { state: 'invalid', cache: null };
  }
  if (!cache || !Array.isArray(cache.routes)) {
    return { state: 'invalid', cache: null };
  }
  if (cache.version !== INCREMENTAL_CACHE_VERSION) {
    return { state: 'version-mismatch', cache };
  }
  return { state: 'ok', cache };
}

/**
 * Writes the incremental cache atomically, leaving an identical file untouched.
 * @param {string} file
 * @param {object} cache
 */
export async function writeIncrementalCache(file, cache) {
  const contents = `${JSON.stringify(cache, null, 2)}\n`;
  return writeFileIfChanged({
    dir: path.dirname(file),
    file: path.basename(file),
    contents,
  });
}

/**
 * Builds the cache key for the output-affecting configuration. Runtime-only options
 * such as concurrency, log level and failure gates are deliberately excluded.
 * @param {object} config
 * @param {string} sourceDir
 * @returns {string}
 */
export function incrementalScope(config, sourceDir) {
  const scope = {
    toolVersion: TOOL_VERSION,
    sourceDir: path.resolve(sourceDir),
    base: config.base,
    flatOutput: config.flatOutput,
    metadata: config.metadata,
    notFoundRoute: config.notFoundRoute,
    locales: config.locales,
    seoLocale: config.seoLocale,
    routeOverrides: (config.routeOverrides ?? [])
      .map(stripIncrementalOverride)
      .filter((override) => Object.keys(override).some((key) => key !== 'match')),
    output: {
      inlineCss: config.inlineCss,
      criticalCssPreload: config.criticalCssPreload,
      minifyHtml: config.minifyHtml,
      minifyCss: config.minifyCss,
      csp: config.csp,
      externalScripts: config.externalScripts,
      removeBlobs: config.removeBlobs,
      removeAttributes: config.removeAttributes,
      removeStyleTags: config.removeStyleTags,
      removeScriptTags: config.removeScriptTags,
      asyncScriptTags: config.asyncScriptTags,
      preconnectThirdParty: config.preconnectThirdParty,
      preloadImages: config.preloadImages,
      preloadLinks: config.preloadLinks,
      preloadManifest: config.preloadManifest,
      ignoreForPreload: config.ignoreForPreload,
      captureRuntimeStyles: config.captureRuntimeStyles,
      captureFormState: config.captureFormState,
      scrollToBottom: config.scrollToBottom,
      stripBuildOriginMetadata: config.stripBuildOriginMetadata,
      transformHtml: functionSource(config.transformHtml),
    },
    render: {
      userAgent: config.userAgent,
      viewport: config.viewport,
      blockThirdParty: config.blockThirdParty,
      allowedHosts: config.allowedHosts,
      ignoreHTTPSErrors: config.ignoreHTTPSErrors,
      storageState: config.storageState,
      framework: config.framework,
      container: config.container,
      fixedTime: config.fixedTime ?? null,
      timezone: config.timezone,
      randomSeed: config.randomSeed,
    },
    vendorAssets: config.vendorAssets.enabled
      ? {
          hosts: config.vendorAssets.hosts,
          types: config.vendorAssets.types,
          maxBytes: config.vendorAssets.maxBytes,
          onError: config.vendorAssets.onError,
        }
      : null,
  };
  return createHash('sha256').update(stableStringify(scope)).digest('hex');
}

/**
 * Adds the content hash of every storage state that can affect rendered output. The
 * cache stores the hash, never the cookies themselves.
 * @param {string} scopeHash
 * @param {object} config
 * @returns {Promise<string>}
 */
export async function addStorageStateToScope(scopeHash, config) {
  const files = new Set();
  if (config.storageState) files.add(path.resolve(config.storageState));
  for (const override of config.routeOverrides ?? []) {
    if (override.storageState) files.add(path.resolve(override.storageState));
  }
  for (const locale of config.locales?.list ?? []) {
    if (locale.storageState) files.add(path.resolve(locale.storageState));
  }
  if (files.size === 0) return scopeHash;
  const parts = [scopeHash];
  for (const file of [...files].sort()) {
    const hash = await hashFile(file).catch(() => 'missing');
    parts.push(`${file}:${hash}`);
  }
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Hashes a file's bytes. Missing files return null so callers can invalidate a route.
 * @param {string} file
 * @returns {Promise<string | null>}
 */
export async function hashFile(file) {
  const data = await fs.readFile(file).catch(() => null);
  if (data === null) return null;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Deletes cache files that the next cache no longer references. Root HTML pages,
 * generated scripts and vendored assets each live in their own directory, so a
 * removed route or changed asset cannot leave an orphan behind.
 * @param {{
 *   cachePath: string,
 *   keepHtml: Iterable<string>,
 *   keepGenerated: Iterable<string>,
 *   keepVendor: Iterable<string>,
 * }} input
 * @returns {Promise<string[]>}
 */
export async function pruneIncrementalCache({ cachePath, keepHtml, keepGenerated, keepVendor }) {
  const htmlDir = incrementalHtmlDir(cachePath);
  const removed = [];
  await pruneCacheDirectory(htmlDir, new Set(keepHtml), removed, (name) => name.endsWith('.html'));
  await pruneCacheDirectory(path.join(htmlDir, 'generated'), new Set(keepGenerated), removed);
  await pruneCacheDirectory(path.join(htmlDir, 'vendor'), new Set(keepVendor), removed);
  return removed.sort();
}

// Inspects a lock without taking it. A dead owner or an old timestamp marks it stale.
async function inspectIncrementalLock(file, staleAfter) {
  const contents = await fs.readFile(file, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (contents === null) return null;
  let owner;
  try {
    owner = JSON.parse(contents);
  } catch {
    owner = null;
  }
  const pid = Number.isInteger(owner?.pid) ? owner.pid : null;
  const startedAt = Number.isFinite(owner?.startedAt) ? owner.startedAt : 0;
  const stale =
    (pid !== null && !isProcessAlive(pid)) ||
    (startedAt > 0 && Date.now() - startedAt > staleAfter);
  return { ...owner, pid, startedAt, stale };
}

// Creates the lock atomically. Returns false when another owner won the race.
async function createIncrementalLock(file, token) {
  let handle;
  try {
    handle = await fs.open(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
  try {
    await handle.writeFile(
      `${JSON.stringify({ pid: process.pid, startedAt: Date.now(), token })}\n`,
      'utf8',
    );
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.rm(file, { force: true }).catch(() => {});
    throw error;
  }
  await handle.close();
  return true;
}

// Reports whether a process can still own a lock on this host.
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// Deletes every file under a cache directory that is not in the keep set.
async function pruneCacheDirectory(dir, keep, removed, filter = () => true) {
  const files = await listCacheFiles(dir);
  for (const relative of files) {
    if (!filter(relative) || keep.has(relative)) continue;
    await fs.rm(path.join(dir, relative), { force: true }).catch(() => {});
    removed.push(relative);
  }
  await removeEmptyDirectories(dir);
}

// Lists files under a directory as forward-slash relative paths.
async function listCacheFiles(dir, root = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listCacheFiles(full, root)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return files;
}

// Removes directories left empty after pruning, keeping the cache root itself.
async function removeEmptyDirectories(dir, root = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) await removeEmptyDirectories(path.join(dir, entry.name), root);
  }
  if (dir === root) return;
  const remaining = await fs.readdir(dir).catch(() => null);
  if (remaining !== null && remaining.length === 0) await fs.rmdir(dir).catch(() => {});
}

// Waits before retrying a lock acquisition.
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Removes the per-route reuse switch, which does not affect rendered output.
function stripIncrementalOverride(override) {
  return Object.fromEntries(Object.entries(override).filter(([key]) => key !== 'incremental'));
}

// Serialises a function by source so a changed transform invalidates cached output.
function functionSource(value) {
  return typeof value === 'function' ? value.toString() : null;
}

// Sorts object keys recursively so the same configuration always produces the same hash.
function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value instanceof RegExp) return { regex: value.source, flags: value.flags };
  if (typeof value === 'function') return value.toString();
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}
