import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [dir, port, mode] = process.argv.slice(2);
const root = path.resolve(dir);

if (mode === 'ignore-sigterm') {
  process.on('SIGTERM', () => {});
}

/**
 * Minimal static server used by the serveCmd integration test. Serves files from
 * the given directory, falls back to index.html for unknown paths, refuses requests
 * that escape the root, and can be told to ignore SIGTERM so shutdown escalation is
 * exercised.
 */
http
  .createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root)) {
      response.statusCode = 403;
      response.end('Forbidden');
      return;
    }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      target = path.join(target, 'index.html');
    }
    if (!fs.existsSync(target)) target = path.join(root, 'index.html');
    response.setHeader('content-type', 'text/html');
    response.end(fs.readFileSync(target));
  })
  .listen(Number(port), '127.0.0.1');
