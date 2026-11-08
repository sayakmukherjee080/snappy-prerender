import { randomUUID } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { CheckError, fetchSiteCheck } from './checker.mjs';

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 1_000;
const MAX_IN_FLIGHT = 20;
const MAX_IN_FLIGHT_PER_IP = 5;
const ALLOWED_ORIGIN = 'https://snappy-prerender.smoldev.com';

let tokens = RATE_LIMIT;
let lastRefill = Date.now();
let inFlight = 0;
const inFlightByIp = new Map();

/**
 * Takes one token from the global 10 request-per-second bucket.
 * @returns {boolean}
 */
function takeToken() {
  const now = Date.now();
  tokens = Math.min(RATE_LIMIT, tokens + ((now - lastRefill) / RATE_WINDOW_MS) * RATE_LIMIT);
  lastRefill = now;
  if (tokens < 1) return false;
  tokens -= 1;
  return true;
}

/**
 * Resolves the caller, trusting Cloudflare's header only when the tunnel is the local peer.
 * @param {http.IncomingMessage} request
 * @returns {string}
 */
function clientAddress(request) {
  const remote = request.socket.remoteAddress ?? 'unknown';
  const forwarded = request.headers['cf-connecting-ip'];
  if (isLoopback(remote) && typeof forwarded === 'string' && net.isIP(forwarded)) {
    return forwarded;
  }
  return remote;
}

/**
 * Reports whether an address is the local loopback used by the tunnel process.
 * @param {string} address
 * @returns {boolean}
 */
function isLoopback(address) {
  const value = address.replace(/^::ffff:/, '');
  return value === '127.0.0.1' || value === '::1';
}

/**
 * Reserves one concurrent slot for a caller, keeping one IP from occupying the pool.
 * @param {string} address
 * @returns {boolean}
 */
function acquireIpSlot(address) {
  const current = inFlightByIp.get(address) ?? 0;
  if (current >= MAX_IN_FLIGHT_PER_IP) return false;
  inFlightByIp.set(address, current + 1);
  return true;
}

/**
 * Releases the caller's concurrent slot.
 * @param {string} address
 */
function releaseIpSlot(address) {
  const current = inFlightByIp.get(address) ?? 0;
  if (current <= 1) inFlightByIp.delete(address);
  else inFlightByIp.set(address, current - 1);
}

/**
 * Handles the public checker API, its CORS preflight and a health probe.
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
async function handle(request, response, checkSite) {
  const requestId = randomUUID();
  response.setHeader('x-request-id', requestId);

  let url;
  try {
    url = new URL(request.url ?? '/', 'http://localhost');
  } catch {
    sendJson(response, 400, {
      success: false,
      error: 'Malformed request URL.',
      code: 'BAD_REQUEST',
    });
    return;
  }
  if (url.pathname === '/health') {
    sendJson(response, 200, { success: true, data: { status: 'ok' } });
    return;
  }
  if (url.pathname !== '/api/check') {
    sendJson(response, 404, {
      success: false,
      error: 'Not found.',
      code: 'NOT_FOUND',
    });
    return;
  }
  if (request.headers.origin !== ALLOWED_ORIGIN) {
    sendJson(
      response,
      403,
      {
        success: false,
        error: `This API only accepts requests from ${ALLOWED_ORIGIN}.`,
        code: 'FORBIDDEN_ORIGIN',
      },
      { vary: 'Origin' },
    );
    return;
  }

  setCors(response);
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== 'GET') {
    request.resume();
    sendJson(
      response,
      405,
      { success: false, error: 'Use GET for this endpoint.', code: 'METHOD_NOT_ALLOWED' },
      { allow: 'GET, OPTIONS' },
    );
    return;
  }
  if (!takeToken()) {
    sendJson(
      response,
      429,
      {
        success: false,
        error: 'Rate limit reached. Try again in a second.',
        code: 'RATE_LIMITED',
      },
      { 'retry-after': '1' },
    );
    return;
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    sendJson(response, 503, {
      success: false,
      error: 'The checker is busy. Try again shortly.',
      code: 'CHECKER_BUSY',
    });
    return;
  }
  const address = clientAddress(request);
  if (!acquireIpSlot(address)) {
    sendJson(response, 503, {
      success: false,
      error: 'Too many concurrent checks from this address.',
      code: 'CHECKER_BUSY',
    });
    return;
  }

  inFlight += 1;
  try {
    const target = url.searchParams.get('url') ?? '';
    const data = await checkSite(target);
    sendJson(response, 200, { success: true, data });
  } catch (error) {
    if (error instanceof CheckError) {
      sendJson(response, error.status, {
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      sendJson(response, 502, {
        success: false,
        error: 'The site could not be checked.',
        code: 'CHECK_FAILED',
      });
    }
  } finally {
    inFlight -= 1;
    releaseIpSlot(address);
  }
}

/**
 * Adds permissive CORS headers for the public, credential-free read API.
 * @param {http.ServerResponse} response
 */
function setCors(response) {
  response.setHeader('access-control-allow-origin', ALLOWED_ORIGIN);
  response.setHeader('vary', 'Origin');
  response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'accept, content-type');
  response.setHeader('access-control-max-age', '86400');
}

/**
 * Writes one JSON response with no-store caching and safe content headers.
 * @param {http.ServerResponse} response
 * @param {number} status
 * @param {object} payload
 * @param {Record<string, string>} [headers]
 */
function sendJson(response, status, payload, headers = {}) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(JSON.stringify(payload));
}

/**
 * Starts the public checker API and returns its bound server.
 * @param {{ port?: number, host?: string, checkSite?: (url: string) => Promise<object> }} options
 * @returns {Promise<{ server: http.Server, port: number }>}
 */
export async function startApiServer({
  port = Number(process.env.API_PORT ?? 4181),
  host = process.env.API_HOST ?? '127.0.0.1',
  checkSite = fetchSiteCheck,
} = {}) {
  const server = http.createServer({ maxHeaderSize: 16 * 1024 }, (request, response) => {
    void handle(request, response, checkSite);
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxConnections = 200;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return { server, port: server.address().port };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg === -1 ? undefined : Number(process.argv[portArg + 1]);
  const { server, port: boundPort } = await startApiServer({ port }).catch((error) => {
    process.stderr.write(`API failed to start: ${error.message}\n`);
    process.exit(1);
  });
  process.stdout.write(`Checker API listening on port ${boundPort}\n`);
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
