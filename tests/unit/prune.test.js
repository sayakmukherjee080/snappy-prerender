import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { pruneStaleFiles, readPruneManifest, writePruneManifest } from '../../src/core/prune.js';

const tempDirs = [];

async function makeDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-prune-'));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

describe('pruneStaleFiles', () => {
  it('removes generated files that are no longer produced and empties their directories', async () => {
    const dir = await makeDir();
    await fs.mkdir(path.join(dir, 'old'), { recursive: true });
    await fs.writeFile(path.join(dir, 'old', 'index.html'), 'old');
    await fs.writeFile(path.join(dir, 'keep.html'), 'keep');

    const removed = await pruneStaleFiles({
      dir,
      previous: ['old/index.html', 'keep.html'],
      current: ['keep.html'],
    });

    assert.deepEqual(removed, ['old/index.html']);
    await assert.rejects(fs.stat(path.join(dir, 'old', 'index.html')), /ENOENT/);
    await assert.rejects(fs.stat(path.join(dir, 'old')), /ENOENT/);
    assert.equal(await fs.readFile(path.join(dir, 'keep.html'), 'utf8'), 'keep');
  });

  it('removes only manifest entries and leaves unlisted files alone', async () => {
    const dir = await makeDir();
    await fs.writeFile(path.join(dir, 'asset.js'), 'asset');
    await pruneStaleFiles({ dir, previous: ['asset.js'], current: [] });
    // The manifest is the authority, so a listed generated file is removed.
    await assert.rejects(fs.stat(path.join(dir, 'asset.js')), /ENOENT/);
    await fs.writeFile(path.join(dir, 'user.txt'), 'user');
    await pruneStaleFiles({ dir, previous: [], current: [] });
    assert.equal(await fs.readFile(path.join(dir, 'user.txt'), 'utf8'), 'user');
  });

  it('ignores traversal paths in a corrupt manifest', async () => {
    const dir = await makeDir();
    const outside = path.join(dir, '..', `${path.basename(dir)}-outside.txt`);
    await fs.writeFile(outside, 'outside');
    try {
      await pruneStaleFiles({ dir, previous: [path.relative(dir, outside)], current: [] });
      assert.equal(await fs.readFile(outside, 'utf8'), 'outside');
    } finally {
      await fs.rm(outside, { force: true });
    }
  });
});

describe('prune manifest', () => {
  it('round trips the file list and excludes robots.txt', async () => {
    const dir = await makeDir();
    await writePruneManifest({ dir, files: ['a/index.html', 'robots.txt', 'b.html'] });
    assert.deepEqual(await readPruneManifest(dir), ['a/index.html', 'b.html']);
  });

  it('treats a missing or malformed manifest as absent', async () => {
    const dir = await makeDir();
    assert.equal(await readPruneManifest(dir), null);
    await fs.writeFile(path.join(dir, '.snappy-manifest.json'), 'not json');
    assert.equal(await readPruneManifest(dir), null);
  });
});
