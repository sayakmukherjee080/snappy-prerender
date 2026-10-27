import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { prepareDestination } from '../../src/core/destination.js';

const tempDirs = [];

async function makeDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-destination-'));
  tempDirs.push(dir);
  return dir;
}

async function exists(target) {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

describe('prepareDestination', () => {
  it('returns the source directory when no destination is configured', async () => {
    const sourceDir = await makeDir();
    assert.equal(await prepareDestination({ sourceDir, destination: null }), sourceDir);
  });

  it('returns the source directory when the destination is the same directory', async () => {
    const sourceDir = await makeDir();
    assert.equal(await prepareDestination({ sourceDir, destination: sourceDir }), sourceDir);
  });

  it('rejects a destination inside the source directory', async () => {
    const sourceDir = await makeDir();
    await assert.rejects(
      prepareDestination({ sourceDir, destination: path.join(sourceDir, 'out') }),
      /destination cannot be inside sourceDir/,
    );
  });

  it('copies the tree and leaves the source untouched', async () => {
    const sourceDir = await makeDir();
    await fs.mkdir(path.join(sourceDir, 'assets'));
    await fs.writeFile(path.join(sourceDir, 'index.html'), 'home');
    await fs.writeFile(path.join(sourceDir, 'assets', 'app.js'), 'js');
    const destination = await makeDir();

    const result = await prepareDestination({ sourceDir, destination });

    assert.equal(result, destination);
    assert.equal(await fs.readFile(path.join(destination, 'index.html'), 'utf8'), 'home');
    assert.equal(await fs.readFile(path.join(destination, 'assets', 'app.js'), 'utf8'), 'js');
    assert.equal(await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8'), 'home');
  });

  it('warns before overwriting a destination that already has files', async () => {
    const sourceDir = await makeDir();
    await fs.writeFile(path.join(sourceDir, 'index.html'), 'home');
    const destination = await makeDir();
    await fs.writeFile(path.join(destination, 'stale.html'), 'old');

    const messages = [];
    const log = { warn: (message) => messages.push(message), debug: () => {} };
    await prepareDestination({ sourceDir, destination, log });

    assert.equal(
      messages.some((message) => message.includes('is not empty')),
      true,
    );
  });

  it('empties the destination first when cleanDestination is on', async () => {
    const sourceDir = await makeDir();
    await fs.writeFile(path.join(sourceDir, 'index.html'), 'home');
    const destination = await makeDir();
    await fs.writeFile(path.join(destination, 'stale.html'), 'old');

    await prepareDestination({ sourceDir, destination, cleanDestination: true });

    assert.equal(await exists(path.join(destination, 'stale.html')), false);
    assert.equal(await fs.readFile(path.join(destination, 'index.html'), 'utf8'), 'home');
  });

  it('refuses to clean a destination that contains the source', async () => {
    const destination = await makeDir();
    const sourceDir = path.join(destination, 'dist');
    await fs.mkdir(sourceDir);
    await fs.writeFile(path.join(sourceDir, 'index.html'), 'home');
    await assert.rejects(
      prepareDestination({ sourceDir, destination, cleanDestination: true }),
      /cleanDestination would delete sourceDir/,
    );
    assert.equal(await fs.readFile(path.join(sourceDir, 'index.html'), 'utf8'), 'home');
  });

  it('stays quiet when the destination does not exist yet', async () => {
    const sourceDir = await makeDir();
    await fs.writeFile(path.join(sourceDir, 'index.html'), 'home');
    const destination = path.join(await makeDir(), 'nested', 'out');

    const messages = [];
    const log = { warn: (message) => messages.push(message), debug: () => {} };
    await prepareDestination({ sourceDir, destination, log });

    assert.deepEqual(messages, []);
    assert.equal(await fs.readFile(path.join(destination, 'index.html'), 'utf8'), 'home');
  });

  it('counts non-file entries such as symlinks that cannot be copied', async (t) => {
    const sourceDir = await makeDir();
    await fs.writeFile(path.join(sourceDir, 'index.html'), 'home');
    try {
      await fs.symlink('index.html', path.join(sourceDir, 'linked.html'));
    } catch (error) {
      t.skip(`symlinks need privileges on this platform: ${error.code}`);
      return;
    }
    const destination = await makeDir();

    const messages = [];
    const log = { warn: (message) => messages.push(message), debug: () => {} };
    await prepareDestination({ sourceDir, destination, log });

    assert.equal(
      messages.some((message) => message.includes('skipped 1 non-file')),
      true,
    );
    assert.equal(await exists(path.join(destination, 'linked.html')), false);
  });
});
