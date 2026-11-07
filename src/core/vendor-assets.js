import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, serialize } from 'parse5';
import { request as playwrightRequest } from 'playwright-core';
import { writeFileIfChanged } from './output.js';
import { toAppPath } from './resources.js';
import { toPublicPath } from './routes.js';

const VENDOR_DIR = 'snappy-assets';
const PAGE_ORIGIN = 'http://snappy.local';
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(['"]?)([^'")]+)\1\s*\)?([^;]*);/gi;
const SKIP_URL = /^(?:data:|blob:|about:|#)/i;

/**
 * Creates the optional asset-localization pass. External CSS, fonts, images and
 * scripts from configured hosts are downloaded into snappy-assets/ and rewritten to
 * local content-hashed URLs. The pass is disabled unless vendorAssets is configured.
 */
export async function createAssetVendor({ config, outputDir, report, log }) {
  if (!config.vendorAssets.enabled) return null;
  return new AssetVendor({ config, outputDir, report, log });
}

/**
 * Downloads and rewrites external assets for one build. Downloads are deduplicated
 * across routes, and every written file is content-addressed.
 */
class AssetVendor {
  constructor({ config, outputDir, report, log }) {
    this.config = config;
    this.outputDir = outputDir;
    this.report = report;
    this.log = log;
    this.context = null;
    this.downloads = new Map();
    this.written = new Map();
    this.failed = new Map();
    this.remaining = new Set();
    this.manifest = new Map();
    this.localizedOrigins = new Set();
    this.totalBytes = 0;
    this.bundled = 0;
    this.skipped = 0;
    this.failedCount = 0;
    this.manifestFile = null;
  }

  /**
   * Localizes every allowlisted external asset in one page and returns the rewritten
   * HTML plus the local font and image dependencies for preload hints.
   * @param {{ html: string, route: string, pageUrl: string | null }} input
   * @returns {Promise<{ html: string, fonts: Map<string, string>, images: string[], changed: boolean, failed: boolean }>}
   */
  async localizeHtml({ html, route, pageUrl }) {
    const document = parse(html);
    const page = pageUrl
      ? new URL(pageUrl)
      : new URL(toPublicPath(route, this.config.base), PAGE_ORIGIN);
    const failuresBefore = this.failedCount;
    const state = { fonts: new Map(), images: [], changed: false, seen: new Set() };
    const walk = async (node) => {
      const tag = node.tagName?.toLowerCase();
      if (tag === 'script') {
        await this.localizeAttribute(node, 'src', 'script', page, state);
      } else if (tag === 'link') {
        await this.localizeLink(node, page, state);
      } else if (tag === 'img') {
        await this.localizeAttribute(node, 'src', 'image', page, state);
        await this.localizeSrcset(node, page, state);
      } else if (tag === 'source') {
        await this.localizeAttribute(node, 'src', 'image', page, state);
        await this.localizeSrcset(node, page, state);
      } else if (tag === 'video') {
        await this.localizeAttribute(node, 'poster', 'image', page, state);
      } else if (tag === 'style') {
        const css = textContent(node);
        const next = await this.processCss(css, page.href, page, state);
        if (next !== css) {
          setText(node, next);
          state.changed = true;
        }
      }
      const style = attribute(node, 'style');
      if (style) {
        const next = await this.processCss(style, page.href, page, state);
        if (next !== style) {
          setAttribute(node, 'style', next);
          state.changed = true;
        }
      }
      for (const child of node.childNodes ?? []) await walk(child);
    };
    await walk(document);
    if (this.localizedOrigins.size > 0) {
      removeLocalizedPreconnects(document, this.localizedOrigins);
    }
    return {
      html: state.changed ? serialize(document) : html,
      fonts: state.fonts,
      images: [...new Set(state.images)],
      changed: state.changed,
      failed: this.failedCount > failuresBefore,
    };
  }

  /**
   * Writes the vendor manifest and returns the public report section.
   * @returns {Promise<object>}
   */
  async finish() {
    if (this.manifest.size > 0) {
      const file = `${VENDOR_DIR}/manifest.json`;
      const entries = [...this.manifest.entries()]
        .map(([local, value]) => ({ local, ...value }))
        .sort((left, right) => left.local.localeCompare(right.local));
      const contents = `${JSON.stringify(entries, null, 2)}\n`;
      const written = await writeFileIfChanged({
        dir: this.outputDir,
        file,
        contents,
      });
      this.report.files.push({
        route: null,
        file,
        status: written.status,
        bytes: Buffer.byteLength(contents),
      });
      this.manifestFile = file;
    }
    return this.summary();
  }

  /**
   * Returns the bundle counts and any allowlisted assets that remain external.
   * @returns {object}
   */
  summary() {
    return {
      enabled: true,
      hosts: this.config.vendorAssets.hosts,
      types: this.config.vendorAssets.types,
      bundled: this.bundled,
      skipped: this.skipped,
      failed: this.failedCount,
      bytes: this.totalBytes,
      manifest: this.manifestFile,
      externalRemaining: [...this.remaining].sort(),
    };
  }

  /**
   * Fails or warns when allowlisted assets could not be localized.
   * @returns {object | null}
   */
  externalError() {
    if (!this.config.vendorAssets.failOnExternalAssets || this.remaining.size === 0) return null;
    return {
      route: null,
      message: `vendorAssets left ${this.remaining.size} allowlisted asset(s) external: ${[...this.remaining].sort().join(', ')}`,
    };
  }

  /**
   * Releases the download context.
   */
  async close() {
    if (this.context) {
      await this.context.dispose().catch(() => {});
      this.context = null;
    }
  }

  // Localizes a link node according to its rel/as values.
  async localizeLink(node, page, state) {
    const rel = attribute(node, 'rel').toLowerCase().split(/\s+/);
    const href = attribute(node, 'href');
    if (!href) return;
    if (rel.includes('stylesheet')) {
      const local = await this.stylesheet(href, page, state, attribute(node, 'integrity'));
      if (local && local !== href) {
        this.replaceAttribute(node, 'href', local, state);
        removeAttribute(node, 'integrity');
      }
      return;
    }
    if (rel.includes('preconnect') || rel.includes('dns-prefetch')) return;
    let kind = null;
    if (rel.includes('modulepreload')) kind = 'script';
    else if (rel.includes('preload')) {
      const as = attribute(node, 'as').toLowerCase();
      kind =
        as === 'style'
          ? 'css'
          : as === 'font'
            ? 'font'
            : as === 'image'
              ? 'image'
              : as === 'script'
                ? 'script'
                : null;
    } else if (rel.includes('icon') || rel.includes('apple-touch-icon')) {
      kind = 'image';
    }
    if (!kind) return;
    if (kind === 'css') {
      const local = await this.stylesheet(href, page, state, attribute(node, 'integrity'));
      if (local && local !== href) {
        this.replaceAttribute(node, 'href', local, state);
        removeAttribute(node, 'integrity');
      }
      return;
    }
    const local = await this.asset(href, kind, page, state, attribute(node, 'integrity'));
    if (local && local !== href) this.replaceAttribute(node, 'href', local, state);
  }

  // Localizes one src/href/poster attribute.
  async localizeAttribute(node, name, kind, page, state) {
    const raw = attribute(node, name);
    if (!raw) return;
    const integrity = attribute(node, 'integrity');
    if (kind === 'image') {
      const local = await this.asset(raw, kind, page, state);
      if (local && local !== raw) {
        this.replaceAttribute(node, name, local, state);
        state.images.push(toAppPath(local, this.config.base) ?? local);
      }
      return;
    }
    const local = await this.asset(raw, kind, page, state, integrity);
    if (local && local !== raw) this.replaceAttribute(node, name, local, state);
  }

  // Rewrites every candidate in a srcset.
  async localizeSrcset(node, page, state) {
    const raw = attribute(node, 'srcset');
    if (!raw) return;
    const candidates = [];
    let changed = false;
    for (const entry of raw.split(',')) {
      const [url, ...descriptor] = entry.trim().split(/\s+/);
      if (!url) continue;
      const local = await this.asset(url, 'image', page, state);
      if (local && local !== url) {
        changed = true;
        state.images.push(toAppPath(local, this.config.base) ?? local);
      }
      candidates.push([local ?? url, ...descriptor].join(' '));
    }
    if (changed) {
      setAttribute(node, 'srcset', candidates.join(', '));
      state.changed = true;
    }
  }

  // Processes one stylesheet, localizing @import and url() references. Local sheets
  // are only copied when their rewritten text differs.
  async stylesheet(raw, page, state, integrity = '') {
    const url = resolveUrl(raw, page);
    if (!url) return raw;
    if (!this.config.vendorAssets.types.includes('css')) {
      this.remaining.add(url.href);
      this.skipped += 1;
      return raw;
    }
    if (state.seen.has(url.href)) return raw;
    state.seen.add(url.href);
    if (url.origin === page.origin && isLocalAsset(url, this.outputDir, this.config.base)) {
      const file = localFile(this.outputDir, url, this.config.base);
      if (!file) return raw;
      const css = await fs.readFile(file, 'utf8').catch(() => null);
      if (css === null) return raw;
      if (integrity && !verifyIntegrity(Buffer.from(css), integrity)) {
        this.fail(url, 'Subresource Integrity did not match');
        return raw;
      }
      const next = await this.processCss(css, url.href, page, state);
      if (next === css) return raw;
      const local = await this.writeAsset(
        Buffer.from(next),
        'css',
        url,
        state,
        'text/css',
        sha256(Buffer.from(css)),
      );
      return local ?? raw;
    }
    if (!this.hostAllowed(url)) {
      this.remaining.add(url.href);
      this.skipped += 1;
      return raw;
    }
    const fetched = await this.fetch(url);
    if (!fetched.ok) {
      this.fail(url, fetched.reason);
      return raw;
    }
    if (!contentTypeMatches('css', fetched.contentType)) {
      this.fail(url, `unexpected content type ${fetched.contentType}`);
      return raw;
    }
    if (integrity && !verifyIntegrity(fetched.bytes, integrity)) {
      this.fail(url, 'Subresource Integrity did not match');
      return raw;
    }
    const cssUrl = fetched.finalUrl ?? url.href;
    const next = await this.processCss(fetched.text, cssUrl, page, state);
    const local = await this.writeAsset(
      Buffer.from(next),
      'css',
      url,
      state,
      fetched.contentType,
      sha256(fetched.bytes),
    );
    return local ?? raw;
  }

  // Rewrites @import and url() references in a CSS string.
  async processCss(css, cssUrl, page, state) {
    let output = css;
    const imports = [...output.matchAll(CSS_IMPORT)];
    for (const match of imports) {
      const raw = match[2].trim();
      if (SKIP_URL.test(raw)) continue;
      const url = resolveUrl(raw, new URL(cssUrl));
      if (!url) continue;
      const local = await this.stylesheet(url.href, page, state);
      if (local && local !== raw) {
        output = output.replaceAll(match[0], match[0].replace(raw, local));
      }
    }
    const replacements = [];
    for (const match of output.matchAll(CSS_URL)) {
      const raw = match[2].trim();
      if (SKIP_URL.test(raw)) continue;
      const url = resolveUrl(raw, new URL(cssUrl));
      if (!url) continue;
      if (url.origin === page.origin && isLocalAsset(url, this.outputDir, this.config.base))
        continue;
      const local = await this.asset(url.href, 'unknown', page, state);
      if (local && local !== raw) replacements.push({ match: match[0], raw, local });
    }
    for (const replacement of replacements) {
      output = output.replaceAll(
        replacement.match,
        replacement.match.replace(replacement.raw, replacement.local),
      );
    }
    return output;
  }

  // Downloads once and writes one content-hashed local file.
  async asset(raw, kind, page, state, integrity = '') {
    const url = resolveUrl(raw, page);
    if (!url) return raw;
    if (url.origin === page.origin && isLocalAsset(url, this.outputDir, this.config.base))
      return raw;
    if (!this.hostAllowed(url)) {
      this.remaining.add(url.href);
      this.skipped += 1;
      return raw;
    }
    const fetched = await this.fetch(url);
    if (!fetched.ok) {
      this.fail(url, fetched.reason);
      return raw;
    }
    if (kind !== 'unknown' && !contentTypeMatches(kind, fetched.contentType)) {
      this.fail(url, `unexpected content type ${fetched.contentType}`);
      return raw;
    }
    if (integrity && !verifyIntegrity(fetched.bytes, integrity)) {
      this.fail(url, 'Subresource Integrity did not match');
      return raw;
    }
    const inferred = inferType(fetched.contentType, fetched.finalUrl ?? url.href);
    const type = kind === 'unknown' ? inferred : kind;
    if (!type || !this.typeEnabled(type, kind) || (kind === 'unknown' && !inferred)) {
      this.remaining.add(url.href);
      this.skipped += 1;
      return raw;
    }
    if (type === 'css') {
      return this.stylesheet(url.href, page, state);
    }
    const local = await this.writeAsset(
      fetched.bytes,
      type,
      url,
      state,
      fetched.contentType,
      sha256(fetched.bytes),
    );
    if (local && type === 'font') {
      const appPath = toAppPath(local, this.config.base);
      if (appPath) state.fonts.set(appPath, fetched.contentType ?? 'font/woff2');
    }
    return local ?? raw;
  }

  // Fetches a URL once, enforcing host, redirect, size and content-type limits.
  async fetch(url) {
    if (this.downloads.has(url.href)) return this.downloads.get(url.href);
    const promise = this.fetchNow(url);
    this.downloads.set(url.href, promise);
    return promise;
  }

  async fetchNow(url) {
    if (!this.context) {
      this.context = await playwrightRequest.newContext({
        storageState: this.config.storageState ?? undefined,
        userAgent: this.config.userAgent ?? undefined,
        ignoreHTTPSErrors: this.config.ignoreHTTPSErrors,
        timeout: this.config.timeout,
        maxRedirects: 5,
      });
    }
    let response;
    try {
      response = await this.context.fetch(url.href, {
        method: 'GET',
        timeout: this.config.timeout,
        failOnStatusCode: false,
      });
    } catch (error) {
      return { ok: false, reason: error.message };
    }
    const finalUrl = response.url();
    if (!this.hostAllowed(new URL(finalUrl))) {
      return { ok: false, reason: `redirected to a host outside vendorAssets.hosts: ${finalUrl}` };
    }
    if (response.status() < 200 || response.status() >= 300) {
      return { ok: false, reason: `HTTP ${response.status()}` };
    }
    let bytes;
    try {
      bytes = await response.body();
    } catch (error) {
      return { ok: false, reason: `body read failed: ${error.message}` };
    }
    if (bytes.length > this.config.vendorAssets.maxBytes) {
      return {
        ok: false,
        reason: `asset is larger than vendorAssets.maxBytes (${bytes.length} bytes)`,
      };
    }
    const contentType = (response.headers()['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    return {
      ok: true,
      bytes,
      contentType,
      text: bytes.toString('utf8'),
      finalUrl,
    };
  }

  // Writes one content-hashed vendor file and records it for pruning and the manifest.
  async writeAsset(bytes, type, url, state, contentType = '', sourceHash = null) {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const extension = extensionFor(type, contentType, url.pathname);
    const file = `${VENDOR_DIR}/${hash}${extension}`;
    const publicPath = toPublicPath(`/${file}`, this.config.base);
    if (!this.written.has(file)) {
      const pending = (async () => {
        const written = await writeFileIfChanged({
          dir: this.outputDir,
          file,
          contents: bytes,
        });
        this.report.files.push({ route: null, file, status: written.status, bytes: bytes.length });
        this.bundled += 1;
        this.totalBytes += bytes.length;
        this.manifest.set(publicPath, {
          url: url.href,
          type,
          contentType: contentType || null,
          hash,
          sourceHash: sourceHash ?? hash,
          bytes: bytes.length,
        });
        return written;
      })();
      this.written.set(file, pending);
    }
    await this.written.get(file);
    this.localizedOrigins.add(url.origin);
    state.changed = true;
    return publicPath;
  }

  // Reports or throws for one failed download.
  fail(url, reason) {
    this.failedCount += 1;
    this.failed.set(url.href, reason);
    this.remaining.add(url.href);
    const message = `vendorAssets could not download ${url.href}: ${reason}`;
    if (this.config.vendorAssets.onError === 'fail') throw new Error(message);
    this.log.warn(`  ${message}`);
  }

  // Applies the host allowlist. Explicitly listed private hosts are allowed.
  hostAllowed(url) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    const withPort = url.port ? `${host}:${url.port}` : host;
    const explicitlyListed = this.config.vendorAssets.hosts.some((entry) => {
      const value = String(entry).trim().toLowerCase();
      return value === withPort || value === host;
    });
    if (isPrivateHost(host) && !explicitlyListed) return false;
    return this.config.vendorAssets.hosts.some((entry) => hostMatches(host, withPort, entry));
  }

  // Reports whether the configured types allow a localized asset.
  typeEnabled(type, kind) {
    const types = this.config.vendorAssets.types;
    if (kind === 'unknown') return types.includes(type);
    return types.includes(type);
  }

  // Replaces an attribute and marks the page as changed.
  replaceAttribute(node, name, value, state) {
    setAttribute(node, name, value);
    state.changed = true;
  }
}

/**
 * Reports whether a response content type is compatible with the asset kind the page
 * requested. A missing header is tolerated because some CDNs omit it; a present but
 * unrelated type is refused so an HTML error page is never written as a script or
 * stylesheet.
 * @param {string} kind
 * @param {string} contentType
 * @returns {boolean}
 */
function contentTypeMatches(kind, contentType) {
  if (!contentType) return true;
  const type = contentType.toLowerCase();
  if (kind === 'css') return type === 'text/css';
  if (kind === 'script') return /javascript|ecmascript/.test(type);
  if (kind === 'font') {
    return (
      type.startsWith('font/') ||
      /^application\/(?:x-)?font/.test(type) ||
      type === 'application/vnd.ms-fontobject' ||
      type === 'application/octet-stream'
    );
  }
  if (kind === 'image') return type.startsWith('image/');
  return true;
}

/**
 * Infers a static asset type from its content type or URL extension.
 * @param {string} contentType
 * @param {string} url
 * @returns {string | null}
 */
export function inferType(contentType, url) {
  const type = String(contentType ?? '').toLowerCase();
  const pathname = safePathname(url);
  if (type === 'text/css' || pathname.endsWith('.css')) return 'css';
  if (/javascript|ecmascript/.test(type) || /\.(?:m?js)$/.test(pathname)) return 'script';
  if (type.startsWith('font/') || /\.(?:woff2?|ttf|otf|eot)$/.test(pathname)) return 'font';
  if (type.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|svg|avif|ico)$/.test(pathname)) {
    return 'image';
  }
  return null;
}

/**
 * Checks a SRI attribute against the downloaded bytes. The caller decides whether a
 * mismatch leaves the asset external or fails the build.
 * @param {Buffer} bytes
 * @param {string} integrity
 * @returns {boolean}
 */
export function verifyIntegrity(bytes, integrity) {
  if (!integrity) return true;
  for (const token of integrity.trim().split(/\s+/)) {
    const match = /^(sha256|sha384|sha512)-(.+)$/i.exec(token);
    if (!match) continue;
    const actual = createHash(match[1].toLowerCase()).update(bytes).digest('base64');
    if (actual === match[2]) return true;
  }
  return false;
}

// Returns a SHA-256 hex digest for downloaded or original bytes.
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Resolves an asset URL against a base URL.
function resolveUrl(raw, base) {
  if (!raw || SKIP_URL.test(raw)) return null;
  try {
    return new URL(raw, base);
  } catch {
    return null;
  }
}

// Reads one attribute value.
function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

// Sets one attribute, replacing an existing value.
function setAttribute(node, name, value) {
  const attrs = node.attrs ?? [];
  const existing = attrs.find((entry) => entry.name === name);
  if (existing) existing.value = value;
  else attrs.push({ name, value });
  node.attrs = attrs;
}

// Removes one attribute when it exists.
function removeAttribute(node, name) {
  if (!node.attrs) return;
  node.attrs = node.attrs.filter((entry) => entry.name !== name);
}

// Reads text beneath a node, used for style elements.
function textContent(node) {
  return (node.childNodes ?? []).map((child) => child.value ?? '').join('');
}

// Replaces the text beneath a style element.
function setText(node, value) {
  node.childNodes = [{ nodeName: '#text', value, parentNode: node }];
}

// Removes preconnect and dns-prefetch hints for origins that are now local.
function removeLocalizedPreconnects(document, origins) {
  const walk = (node) => {
    if (node.tagName === 'link') {
      const rel = attribute(node, 'rel').toLowerCase();
      if (rel === 'preconnect' || rel === 'dns-prefetch') {
        try {
          if (origins.has(new URL(attribute(node, 'href')).origin)) {
            node.parentNode?.childNodes?.splice(node.parentNode.childNodes.indexOf(node), 1);
            return;
          }
        } catch {
          // Leave malformed hints untouched.
        }
      }
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
}

// Maps an asset type and content type to a file extension.
function extensionFor(type, contentType, pathname) {
  const fromPath = path.extname(safePathname(pathname));
  if (fromPath) return fromPath;
  if (type === 'css') return '.css';
  if (type === 'script') return '.js';
  if (type === 'font') {
    if (contentType?.includes('woff2')) return '.woff2';
    if (contentType?.includes('woff')) return '.woff';
    if (contentType?.includes('ttf')) return '.ttf';
    if (contentType?.includes('otf')) return '.otf';
    return '.woff2';
  }
  const imageExtensions = {
    'image/svg+xml': '.svg',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
  };
  if (contentType && imageExtensions[contentType]) return imageExtensions[contentType];
  if (contentType?.startsWith('image/')) return `.${contentType.slice('image/'.length)}`;
  return '.bin';
}

// Returns a URL pathname without throwing on malformed input.
function safePathname(value) {
  try {
    return new URL(value, PAGE_ORIGIN).pathname.toLowerCase();
  } catch {
    return String(value).toLowerCase();
  }
}

// Reports whether a URL points at a file already present in the output directory.
function isLocalAsset(url, outputDir, base) {
  const appPath = toAppPath(url.href, base);
  if (!appPath) return false;
  return localFile(outputDir, url, base) !== null;
}

// Resolves a local asset URL to a file inside the output directory.
function localFile(outputDir, url, base) {
  const appPath = toAppPath(url.href, base);
  if (!appPath) return null;
  const root = path.resolve(outputDir);
  const target = path.resolve(root, `.${appPath}`);
  return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
}

// Matches a host or host:port against an allowlist entry, including *.example.com.
function hostMatches(host, withPort, entry) {
  const value = String(entry).trim().toLowerCase();
  if (!value) return false;
  if (value === withPort || value === host) return true;
  if (value.startsWith('*.')) {
    const suffix = value.slice(1);
    return host.endsWith(suffix) && host !== value.slice(2);
  }
  return false;
}

// Detects loopback, private, link-local and unique-local literal hosts.
function isPrivateHost(host) {
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^(?:fc|fd|fe80):/i.test(host)) return true;
  return false;
}
