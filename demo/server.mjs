import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import sirv from 'sirv';
import { CheckError, fetchSiteCheck } from './checker.mjs';

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const RATE_BUCKETS = new Map();

/**
 * Builds the HTTP handler for the demo without opening a socket, so tests can drive it.
 * @param {{ root: string, checkSite?: (url: string) => Promise<object> }} options
 * @returns {http.Server}
 */
export function createDemoServer({ root, checkSite = fetchSiteCheck }) {
  if (!root) throw new TypeError('root is required');

  const landing = sirv(root, { dev: true, etag: true });
  const before = sirv(path.join(root, 'before'), { dev: true, etag: true, single: true });
  const after = sirv(path.join(root, 'after'), { dev: true, etag: true });
  const notFoundPage = path.join(root, 'after', '404.html');

  return http.createServer((request, response) => {
    response.setHeader('x-request-id', randomUUID());

    const url = request.url ?? '/';
    if (url === '/api/check' || url.startsWith('/api/check?')) {
      void handleCheck(request, response, checkSite);
      return;
    }
    if (url === '/before' || url === '/after') {
      response.statusCode = 301;
      response.setHeader('location', `${url}/`);
      response.end();
      return;
    }
    if (url.startsWith('/before/')) {
      request.url = url.slice('/before'.length);
      before(request, response, () => notFound(response));
      return;
    }
    if (url.startsWith('/after/')) {
      request.url = url.slice('/after'.length);
      after(request, response, () => sendNotFoundPage(response, notFoundPage));
      return;
    }
    landing(request, response, () => notFound(response));
  });
}

/**
 * Starts the demo server on a host and port and returns its bound origin.
 * @param {{ root: string, port?: number, host?: string, checkSite?: (url: string) => Promise<object> }} options
 * @returns {Promise<{ server: http.Server, origin: string, close: () => Promise<void> }>}
 */
export async function startDemoServer({ root, port = 4180, host = '127.0.0.1', checkSite } = {}) {
  const server = createDemoServer({ root, checkSite });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const origin = `http://${host}:${address.port}`;
  return {
    server,
    origin,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/**
 * Handles GET /api/check with validation, rate limiting and a stable JSON envelope.
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @param {(url: string) => Promise<object>} checkSite
 */
async function handleCheck(request, response, checkSite) {
  if (request.method !== 'GET') {
    request.resume();
    sendJson(
      response,
      405,
      { success: false, error: 'Use GET for this endpoint.', code: 'METHOD_NOT_ALLOWED' },
      { allow: 'GET' },
    );
    return;
  }
  if (!allowRequest(clientAddress(request))) {
    sendJson(response, 429, {
      success: false,
      error: 'Too many checks. Try again in a minute.',
      code: 'RATE_LIMITED',
    });
    return;
  }

  let target = '';
  try {
    target = new URL(request.url, 'http://localhost').searchParams.get('url') ?? '';
  } catch {
    sendJson(response, 400, {
      success: false,
      error: 'Enter a valid http or https URL.',
      code: 'INVALID_URL',
    });
    return;
  }
  try {
    const data = await checkSite(target);
    sendJson(response, 200, { success: true, data });
  } catch (error) {
    if (error instanceof CheckError) {
      sendJson(response, error.status, {
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }
    sendJson(response, 502, {
      success: false,
      error: 'The site could not be checked.',
      code: 'CHECK_FAILED',
    });
  }
}

/**
 * Resolves the caller behind the tunnel, falling back to the socket address.
 * @param {http.IncomingMessage} request
 * @returns {string}
 */
function clientAddress(request) {
  const forwarded = request.headers['cf-connecting-ip'];
  if (typeof forwarded === 'string' && forwarded) return forwarded;
  return request.socket.remoteAddress ?? 'unknown';
}

/**
 * Applies a small in-memory sliding window so one caller cannot loop the checker.
 * @param {string} address
 * @returns {boolean}
 */
function allowRequest(address) {
  const now = Date.now();
  if (RATE_BUCKETS.size > 5_000) {
    for (const [key, entry] of RATE_BUCKETS) {
      if (now >= entry.resetAt) RATE_BUCKETS.delete(key);
    }
  }
  const bucket = RATE_BUCKETS.get(address);
  if (!bucket || now >= bucket.resetAt) {
    RATE_BUCKETS.set(address, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

/**
 * Writes a JSON response with no-store caching and a request correlation header.
 * @param {http.ServerResponse} response
 * @param {number} status
 * @param {object} payload
 * @param {Record<string, string>} [headers]
 */
function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(body);
}

/**
 * Answers an unknown prerendered route with the generated 404 document.
 * @param {http.ServerResponse} response
 * @param {string} notFoundPage
 */
async function sendNotFoundPage(response, notFoundPage) {
  try {
    const body = await fs.readFile(notFoundPage);
    response.statusCode = 404;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(body);
  } catch {
    notFound(response);
  }
}

/**
 * Answers a request no static handler could serve.
 * @param {http.ServerResponse} response
 */
function notFound(response) {
  response.statusCode = 404;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end('Not found');
}
