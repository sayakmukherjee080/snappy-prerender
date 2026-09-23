import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { startStaticServer } from '../../src/core/server.js';

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
