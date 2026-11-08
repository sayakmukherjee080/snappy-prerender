import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_LLMS_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 20_000;
const LOOKUP_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_META_TAGS = 500;
const MAX_LINK_TAGS = 200;
const MAX_TITLE_CHARS = 300;
const MAX_FIELD_CHARS = 1_000;
const MAX_URL_CHARS = 2_048;
const USER_AGENT =
  'snappy-prerender-site-check/1.0 (+https://github.com/sayakmukherjee080/snappy-prerender)';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal']);
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

const PRIVATE_IPV4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

/**
 * A validation or retrieval failure that maps to an HTTP status and a machine code.
 */
export class CheckError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'CheckError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Normalises a user-entered address into a public http(s) URL.
 * @param {string} value
 * @returns {URL}
 */
export function normalizeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new CheckError('URL_REQUIRED', 'Enter a website URL to check.');
  if (raw.length > MAX_URL_LENGTH) {
    throw new CheckError('URL_TOO_LONG', 'That URL is too long. Use a URL under 2,048 characters.');
  }

  const candidate = /^[a-z][a-z0-9+-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new CheckError('INVALID_URL', 'Enter a valid http or https URL.');
  }

  assertAllowedUrl(url);
  url.hash = '';
  return url;
}

/**
 * Rejects URL shapes the checker will not fetch, including non-web schemes and odd ports.
 * @param {URL} url
 */
function assertAllowedUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CheckError('INVALID_PROTOCOL', 'Only http and https URLs can be checked.');
  }
  if (url.username || url.password) {
    throw new CheckError(
      'CREDENTIALS_NOT_ALLOWED',
      'Remove the username and password from the URL.',
    );
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new CheckError('PORT_NOT_ALLOWED', 'Only ports 80 and 443 can be checked.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || isBlockedHostname(hostname)) {
    throw new CheckError('PRIVATE_ADDRESS', 'That host is not publicly reachable.', 403);
  }
  if (net.isIP(hostname) && isBlockedAddress(hostname)) {
    throw new CheckError('PRIVATE_ADDRESS', 'That host is not publicly reachable.', 403);
  }
}

/**
 * Reports whether a hostname is reserved for local or metadata services.
 * @param {string} hostname
 * @returns {boolean}
 */
function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Reports whether an IP address falls inside a private, loopback, link-local or reserved range.
 * @param {string} address
 * @returns {boolean}
 */
export function isBlockedAddress(address) {
  const value = String(address).split('%')[0].toLowerCase();
  if (net.isIPv4(value)) return isBlockedIpv4(value);
  if (net.isIPv6(value)) return isBlockedIpv6(value);
  return false;
}

/**
 * Checks an IPv4 address against the reserved ranges that must never be fetched.
 * @param {string} address
 * @returns {boolean}
 */
function isBlockedIpv4(address) {
  const value = ipv4ToNumber(address);
  return PRIVATE_IPV4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToNumber(base) & mask) >>> 0;
  });
}

/**
 * Converts a dotted IPv4 address to its unsigned 32-bit value.
 * @param {string} address
 * @returns {number}
 */
function ipv4ToNumber(address) {
  return address
    .split('.')
    .map(Number)
    .reduce((result, part) => ((result << 8) | (part & 0xff)) >>> 0, 0);
}

/**
 * Checks an IPv6 address, including IPv4-mapped forms, against reserved ranges.
 * @param {string} address
 * @returns {boolean}
 */
function isBlockedIpv6(address) {
  if (address === '::' || address === '::1') return true;
  if (address.startsWith('::ffff:0:')) return true;
  if (address.startsWith('::ffff:')) {
    const mapped = address.slice(7);
    if (net.isIPv4(mapped)) return isBlockedIpv4(mapped);
    const hex = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = Number.parseInt(hex[1], 16);
      const low = Number.parseInt(hex[2], 16);
      return isBlockedIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
    }
  }
  if (address.startsWith('::') && net.isIPv4(address.slice(2))) {
    return isBlockedIpv4(address.slice(2));
  }
  if (/^f[cd][0-9a-f]{2}:/.test(address)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(address)) return true;
  if (/^ff[0-9a-f]{2}:/.test(address)) return true;
  if (address.startsWith('2001:db8:')) return true;
  if (address.startsWith('64:ff9b:')) return true;
  if (address.startsWith('2002:')) return true;
  return address.startsWith('2001:0:');
}

/**
 * Resolves a hostname, rejects private and reserved addresses, and returns one pinned address
 * so the connection cannot be rebound between the check and the request.
 * @param {string} hostname
 * @param {number} [timeoutMs]
 * @returns {Promise<{ address: string, family: number }>}
 */
export async function assertSafeHost(hostname, timeoutMs = LOOKUP_TIMEOUT_MS) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isBlockedHostname(host)) {
    throw new CheckError('PRIVATE_ADDRESS', 'That host is not publicly reachable.', 403);
  }
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new CheckError('PRIVATE_ADDRESS', 'That host is not publicly reachable.', 403);
    }
    return { address: host, family: net.isIPv6(host) ? 6 : 4 };
  }

  let addresses;
  try {
    addresses = await withTimeout(
      dns.lookup(host, { all: true, verbatim: true }),
      timeoutMs,
      'That host took too long to resolve.',
    );
  } catch (error) {
    if (error instanceof CheckError) throw error;
    throw new CheckError('HOST_NOT_FOUND', 'Could not resolve that host.', 502);
  }
  if (addresses.length === 0) {
    throw new CheckError('HOST_NOT_FOUND', 'Could not resolve that host.', 502);
  }
  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new CheckError('PRIVATE_ADDRESS', 'That host is not publicly reachable.', 403);
  }
  const pinned = addresses.find(({ family }) => family === 4) ?? addresses[0];
  return { address: pinned.address, family: pinned.family };
}

/**
 * Reads an HTTP response stream up to a byte limit, decompressing common encodings and
 * enforcing an absolute deadline so a slow trickle cannot extend the request.
 * @param {import('node:http').IncomingMessage} response
 * @param {number} maxBytes
 * @param {number} deadline
 * @returns {Promise<Buffer>}
 */
async function readLimited(response, maxBytes, deadline) {
  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    response.destroy();
    throw new CheckError(
      'RESPONSE_TOO_LARGE',
      'That response is larger than the checker allows.',
      422,
    );
  }

  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
  let stream = response;
  if (encoding === 'gzip') stream = response.pipe(zlib.createGunzip());
  else if (encoding === 'deflate') stream = response.pipe(zlib.createInflate());
  else if (encoding === 'br') stream = response.pipe(zlib.createBrotliDecompress());

  const chunks = [];
  let total = 0;
  let timedOut = false;
  const absolute = setTimeout(
    () => {
      timedOut = true;
      response.destroy();
    },
    Math.max(0, deadline - Date.now()),
  );
  absolute.unref?.();

  try {
    for await (const chunk of stream) {
      total += chunk.length;
      if (total > maxBytes) {
        response.destroy();
        throw new CheckError(
          'RESPONSE_TOO_LARGE',
          'That response is larger than the checker allows.',
          422,
        );
      }
      chunks.push(chunk);
    }
    if (timedOut) {
      throw new CheckError('SITE_TIMEOUT', 'The site took too long to respond.', 504);
    }
  } catch (error) {
    response.destroy();
    if (timedOut) {
      throw new CheckError('SITE_TIMEOUT', 'The site took too long to respond.', 504);
    }
    if (error instanceof CheckError) throw error;
    throw new CheckError('SITE_UNREACHABLE', 'The response could not be read.', 502);
  } finally {
    clearTimeout(absolute);
  }
  return Buffer.concat(chunks);
}

/**
 * Decodes a response buffer using the charset declared by the server.
 * @param {Buffer} buffer
 * @param {string | string[] | undefined} contentType
 * @returns {string}
 */
function decodeBody(buffer, contentType) {
  const charset = /charset=["']?([^;"'\s]+)/i.exec(String(contentType ?? ''))?.[1];
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

/**
 * Issues one HTTP request to the checked IP so DNS cannot be rebound after validation.
 * @param {URL} url
 * @param {{ address: string, family: number }} pinned
 * @param {string} accept
 * @param {number} timeoutMs
 * @returns {Promise<import('node:http').IncomingMessage>}
 */
function requestOnce(url, pinned, accept, timeoutMs) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const hostname = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
    const options = {
      protocol: url.protocol,
      hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      maxHeaderSize: 16 * 1024,
      headers: {
        accept,
        'accept-encoding': 'identity',
        'accept-language': 'en',
        'user-agent': USER_AGENT,
      },
      lookup: (host, lookupOptions, callback) => {
        if (lookupOptions?.all) {
          callback(null, [{ address: pinned.address, family: pinned.family }]);
        } else {
          callback(null, pinned.address, pinned.family);
        }
      },
    };
    if (url.protocol === 'https:' && !net.isIP(hostname)) options.servername = hostname;

    const request = transport.request(options, resolve);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new CheckError('SITE_TIMEOUT', 'The site took too long to respond.', 504));
    });
    request.on('error', (error) => {
      reject(error instanceof CheckError ? error : mapFetchError(error));
    });
    request.end();
  });
}

/**
 * Fetches a document, validating every host and redirect target before following it.
 * @param {URL} url
 * @param {{ accept: string, maxBytes: number, deadline: number, type?: 'html' | 'text' }} options
 * @returns {Promise<{ status: number, headers: object, body: string, bytes: number, url: URL }>}
 */
async function fetchDocument(url, { accept, maxBytes, deadline, type }) {
  let current = new URL(url.href);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new CheckError('SITE_TIMEOUT', 'The site took too long to respond.', 504);
    }
    const pinned = await assertSafeHost(current.hostname, Math.min(LOOKUP_TIMEOUT_MS, remaining));
    const response = await requestOnce(
      current,
      pinned,
      accept,
      Math.min(FETCH_TIMEOUT_MS, remaining),
    );
    const status = response.statusCode ?? 0;

    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.destroy();
      if (!location) {
        throw new CheckError(
          'BAD_REDIRECT',
          'The site returned a redirect without a location.',
          502,
        );
      }
      const next = new URL(String(location), current);
      assertAllowedUrl(next);
      current = next;
      continue;
    }

    const contentType = String(response.headers['content-type'] ?? '');
    if (
      type === 'html' &&
      contentType &&
      !/text\/html|application\/xhtml\+xml/i.test(contentType)
    ) {
      response.destroy();
      throw new CheckError('NOT_HTML', 'That URL did not return an HTML page.', 422);
    }
    if (type === 'text' && contentType && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
      response.destroy();
      throw new CheckError('NOT_TEXT', 'That URL did not return a text file.', 422);
    }

    const buffer = await readLimited(response, maxBytes, deadline);
    return {
      status,
      headers: response.headers,
      body: decodeBody(buffer, contentType),
      bytes: buffer.length,
      url: current,
    };
  }
  throw new CheckError('TOO_MANY_REDIRECTS', 'The site redirected too many times.', 502);
}

/**
 * Converts network failures into stable checker errors.
 * @param {Error} error
 * @returns {CheckError}
 */
function mapFetchError(error) {
  if (error?.code === 'ETIMEDOUT') {
    return new CheckError('SITE_TIMEOUT', 'The site took too long to respond.', 504);
  }
  return new CheckError('SITE_UNREACHABLE', 'Could not reach that site.', 502);
}

/**
 * Runs a promise against a timeout and clears the timer when the promise settles.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
async function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CheckError('SITE_TIMEOUT', message, 504)), ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the attributes of a single HTML start tag without a full DOM parser.
 * @param {string} source
 * @returns {Record<string, string>}
 */
function readAttributes(source) {
  const attributes = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

/**
 * Decodes the small set of HTML entities that appear in titles and metadata.
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hexadecimal = entity[1].toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Shortens a metadata value so one hostile page cannot return megabytes of text.
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Extracts title, description, canonical, Open Graph and Twitter metadata from HTML.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {object}
 */
export function parseMetadata(html, baseUrl) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html;
  const titleSource = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const metas = [...head.matchAll(/<meta\b([^>]*)>/gi)]
    .slice(0, MAX_META_TAGS)
    .map((match) => readAttributes(match[1]));
  const byName = new Map();
  const byProperty = new Map();
  for (const attributes of metas) {
    const content = attributes.content ?? '';
    if (attributes.name) byName.set(attributes.name.toLowerCase(), content);
    if (attributes.property) byProperty.set(attributes.property.toLowerCase(), content);
  }
  const links = [...head.matchAll(/<link\b([^>]*)>/gi)]
    .slice(0, MAX_LINK_TAGS)
    .map((match) => readAttributes(match[1]));
  const canonical =
    links.find((attributes) =>
      (attributes.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'),
    )?.href ?? null;
  const field = (value, max = MAX_FIELD_CHARS) => clip(decodeEntities(value ?? ''), max) || null;
  const resolve = (value) => {
    if (!value) return null;
    const decoded = decodeEntities(value);
    try {
      const url = new URL(decoded, baseUrl);
      return clip(
        url.protocol === 'http:' || url.protocol === 'https:' ? url.href : decoded,
        MAX_URL_CHARS,
      );
    } catch {
      return clip(decoded, MAX_URL_CHARS);
    }
  };
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const htmlTag = html.match(/<html\b([^>]*)>/i)?.[1] ?? '';
  const language = readAttributes(htmlTag).lang ?? null;

  return {
    title: field(titleSource.replace(/<[^>]+>/g, '').trim(), MAX_TITLE_CHARS),
    description: field(byName.get('description')),
    canonical: resolve(canonical),
    robots: field(byName.get('robots'), 200),
    lang: clip(language ?? '', 35) || null,
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    textLength: body.length,
    og: {
      title: field(byProperty.get('og:title'), MAX_TITLE_CHARS),
      description: field(byProperty.get('og:description')),
      image: resolve(byProperty.get('og:image')),
      url: resolve(byProperty.get('og:url')),
      type: field(byProperty.get('og:type'), 100),
      siteName: field(byProperty.get('og:site_name'), 200),
    },
    twitter: {
      card: field(byName.get('twitter:card'), 100),
      title: field(byName.get('twitter:title'), MAX_TITLE_CHARS),
      description: field(byName.get('twitter:description')),
      image: resolve(byName.get('twitter:image')),
    },
  };
}

/**
 * Reports whether a preview image URL is safe for the checker page to load in the browser.
 * Same-origin images inherit the target's validation; cross-origin hosts must be public.
 * @param {string | null} image
 * @param {URL} pageUrl
 * @param {number} remaining
 * @returns {Promise<boolean>}
 */
export async function isSafePreviewImage(image, pageUrl, remaining) {
  if (!image) return false;
  let url;
  try {
    url = new URL(image);
    assertAllowedUrl(url);
  } catch {
    return false;
  }
  if (url.origin === pageUrl.origin) return true;
  if (remaining <= 0) return false;
  try {
    await assertSafeHost(url.hostname, Math.min(LOOKUP_TIMEOUT_MS, remaining));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches a page and its origin's llms.txt, returning crawler-visible metadata for the UI.
 * @param {string} input
 * @returns {Promise<object>}
 */
export async function fetchSiteCheck(input) {
  const target = normalizeUrl(input);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const document = await fetchDocument(target, {
    accept: 'text/html,application/xhtml+xml',
    maxBytes: MAX_HTML_BYTES,
    deadline,
    type: 'html',
  });
  const finalUrl = document.url;
  if (!document.body.trim()) {
    throw new CheckError('EMPTY_PAGE', 'That page returned no HTML.', 422);
  }

  const page = parseMetadata(document.body, finalUrl);
  page.status = document.status;
  page.finalUrl = finalUrl.href;
  page.bytes = document.bytes;
  page.og.imageSafe = await isSafePreviewImage(page.og.image, finalUrl, deadline - Date.now());

  const llmsUrl = new URL('/llms.txt', finalUrl.origin);
  const llms = { url: llmsUrl.href, found: false, status: null, bytes: 0, content: '' };
  try {
    const llmsDocument = await fetchDocument(llmsUrl, {
      accept: 'text/plain,text/markdown,*/*',
      maxBytes: MAX_LLMS_BYTES,
      deadline,
      type: 'text',
    });
    llms.status = llmsDocument.status;
    if (llmsDocument.status >= 200 && llmsDocument.status < 300 && llmsDocument.body.trim()) {
      llms.found = true;
      llms.content = llmsDocument.body;
      llms.bytes = llmsDocument.bytes;
    }
  } catch (error) {
    llms.status = error instanceof CheckError ? error.status : null;
    llms.error = error instanceof CheckError ? error.code : 'LLMS_FETCH_FAILED';
  }

  return {
    target: target.href,
    page,
    llms,
    checkedAt: new Date().toISOString(),
  };
}
