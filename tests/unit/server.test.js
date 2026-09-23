import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startStaticServer, stopProcessTree } from '../../src/core/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const tempDirs = [];

async function makeSite() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-server-'));
  tempDirs.push(dir);
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><title>home</title>');
  await fs.mkdir(path.join(dir, 'about'));
  await fs.writeFile(path.join(dir, 'about', 'index.html'), '<!doctype html><title>about</title>');
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

describe('startStaticServer', () => {
  it('serves routes under a base path and ignores query strings', async () => {
    const dir = await makeSite();
    const server = await startStaticServer({ dir, base: '/app/' });
    try {
      assert.equal((await fetch(`${server.origin}/app`)).status, 200);
      assert.equal((await fetch(`${server.origin}/app/`)).status, 200);
      assert.equal((await fetch(`${server.origin}/app/about?utm=x`)).status, 200);
    } finally {
      await server.close();
    }
  });

  it('rejects requests outside the base path', async () => {
    const dir = await makeSite();
    const server = await startStaticServer({ dir, base: '/app/' });
    try {
      assert.equal((await fetch(`${server.origin}/other`)).status, 404);
    } finally {
      await server.close();
    }
  });

  it('falls back to index.html for unknown SPA routes', async () => {
    const dir = await makeSite();
    const server = await startStaticServer({ dir, base: '/' });
    try {
      const response = await fetch(`${server.origin}/deep/link`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /home/);
    } finally {
      await server.close();
    }
  });
});

/**
 * Builds injectable platform primitives so the POSIX escalation path can be
 * exercised from any host, Windows included.
 */
function fakeIo(overrides) {
  return {
    platform: 'linux',
    hasExited: () => false,
    isGroupAlive: () => false,
    signalGroup: () => {},
    runTaskkill: async () => {},
    ...overrides,
  };
}

/**
 * Waits until the URL answers, so a test only proceeds once the spawned server is
 * really listening.
 */
async function waitForServer(url, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start on ${url}`);
}

/**
 * Waits until the URL stops answering, which is the property that matters after a
 * shutdown: no process is left accepting connections.
 */
async function waitForServerGone(url, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server is still reachable on ${url}`);
}

describe('stopProcessTree', () => {
  it('escalates to SIGKILL when the shell exits but the server keeps running', async () => {
    const signals = [];
    const io = fakeIo({
      hasExited: () => true,
      isGroupAlive: () => !signals.includes('SIGKILL'),
      signalGroup: (_pid, signal) => signals.push(signal),
    });

    assert.equal(await stopProcessTree({ pid: 4242 }, 80, io), true);
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  });

  it('sends no signals when the process group is already gone', async () => {
    const signals = [];
    const io = fakeIo({ signalGroup: (_pid, signal) => signals.push(signal) });

    assert.equal(await stopProcessTree({ pid: 4242 }, 80, io), true);
    assert.deepEqual(signals, []);
  });

  it('reports failure when the group survives SIGKILL', async () => {
    const signals = [];
    const io = fakeIo({
      isGroupAlive: () => true,
      signalGroup: (_pid, signal) => signals.push(signal),
    });

    assert.equal(await stopProcessTree({ pid: 4242 }, 60, io), false);
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  });

  it('uses taskkill on windows and waits for the child to be reaped', async () => {
    const killed = [];
    let exited = false;
    const io = fakeIo({
      platform: 'win32',
      hasExited: () => exited,
      runTaskkill: async (pid) => {
        killed.push(pid);
        exited = true;
      },
    });

    assert.equal(await stopProcessTree({ pid: 777 }, 80, io), true);
    assert.deepEqual(killed, [777]);
  });

  it('does nothing when the child has no pid', async () => {
    const io = fakeIo({
      signalGroup: () => assert.fail('should not signal a child without a pid'),
    });

    assert.equal(await stopProcessTree({ pid: undefined }, 50, io), true);
  });

  it('kills a real shell-wrapped server that ignores SIGTERM', async () => {
    const dir = await makeSite();
    const port = 45000 + Math.floor(Math.random() * 2000);
    const url = `http://127.0.0.1:${port}/`;
    const fixture = path.join(here, '..', 'fixtures', 'static-server.mjs');
    const quote = (value) => `"${value}"`;
    const child = spawn(
      `${quote(process.execPath)} ${quote(fixture)} ${quote(dir)} ${port} ignore-sigterm`,
      {
        shell: true,
        detached: process.platform !== 'win32',
        stdio: 'ignore',
      },
    );

    try {
      await waitForServer(url);
      assert.equal(await stopProcessTree(child, 500), true);
      await waitForServerGone(url);
    } finally {
      await stopProcessTree(child, 500);
    }
  });
});
