import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'site');
const portArg = process.argv.indexOf('--port');
const port = Number(portArg === -1 ? (process.env.PORT ?? 4180) : process.argv[portArg + 1]);

const landing = sirv(root, { dev: true, etag: true });
const before = sirv(path.join(root, 'before'), { dev: true, etag: true, single: true });
const after = sirv(path.join(root, 'after'), { dev: true, etag: true, single: true });

/**
 * Serves the landing page and the two builds from one origin.
 */
const server = http.createServer((request, response) => {
  const url = request.url ?? '/';
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
    after(request, response, () => notFound(response));
    return;
  }
  landing(request, response, () => notFound(response));
});

/**
 * Answers a request no static handler could serve.
 * @param {http.ServerResponse} response
 */
function notFound(response) {
  response.statusCode = 404;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end('Not found');
}

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Serving snappy demo on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
