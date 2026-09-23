import { spawn } from 'node:child_process';
import http from 'node:http';
import sirv from 'sirv';

/**
 * Serves the built output for rendering and verification. Runs in sirv dev mode so
 * HTML files written during the run are picked up by the verification pass, and on
 * an ephemeral loopback port so parallel runs never collide.
 */
export async function startStaticServer({ dir, base }) {
  const handler = sirv(dir, { dev: true, etag: true, single: true });
  const server = http.createServer((request, response) => {
    if (base !== '/') {
      const stripped = stripBase(request.url, base);
      if (stripped === null) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      request.url = stripped;
    }
    handler(request, response);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/**
 * Removes the configured base prefix from a request URL, keeping any query string
 * intact. Returns null when the request falls outside the base path.
 */
function stripBase(url, base) {
  const prefix = base.slice(0, -1);
  const [pathname, search] = url.split('?');
  const query = search === undefined ? '' : `?${search}`;
  if (pathname === prefix) return `/${query}`;
  if (pathname.startsWith(`${prefix}/`)) return `${pathname.slice(prefix.length)}${query}`;
  return null;
}

/**
 * Runs a user-provided server command (for apps whose routes need a live API or
 * runtime) and waits until the given URL answers before rendering starts.
 */
export async function startCommandServer({ command, url, timeout, shutdownTimeout }) {
  const child = spawn(command, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const output = [];
  const capture = (chunk) => {
    output.push(chunk.toString());
    if (output.length > 50) output.shift();
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  let spawnError = null;
  let exited = false;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.once('exit', () => {
    exited = true;
  });

  try {
    await waitForUrl(url, timeout, () => {
      if (spawnError) return spawnError;
      return exited ? new Error('process exited before responding') : null;
    });
  } catch (error) {
    await stopChild(child, shutdownTimeout);
    const tail = output.join('').trim();
    throw new Error(
      `serveCmd did not become reachable at ${url}: ${error.message}${tail ? `\n${tail}` : ''}`,
    );
  }

  return {
    origin: new URL(url).origin,
    async close() {
      await stopChild(child, shutdownTimeout);
    },
  };
}

/**
 * Polls the target URL until it answers with a success status, the process dies, or
 * the timeout expires. `failure()` reports a terminal reason when one exists.
 */
async function waitForUrl(url, timeout, failure) {
  const startedAt = Date.now();
  while (true) {
    const reason = failure();
    if (reason) throw reason;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // Server not up yet; retry until the deadline.
    }
    if (Date.now() - startedAt > timeout) throw new Error('timed out waiting for a response');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Terminates the server process tree: SIGTERM first, then SIGKILL if the process is
 * still alive after the configured shutdown timeout. Windows uses taskkill /T /F
 * because detached process groups are not available there.
 */
async function stopChild(child, shutdownTimeout) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));

  if (process.platform === 'win32') {
    await runTaskkill(child.pid);
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }

  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), shutdownTimeout)),
  ]);
  if (!timedOut) return;

  if (process.platform === 'win32') {
    await runTaskkill(child.pid);
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, shutdownTimeout))]);
}

// Force-kills a process tree on Windows, resolving regardless of taskkill's outcome.
function runTaskkill(pid) {
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    killer.once('exit', resolve);
    killer.once('error', resolve);
  });
}
