import fs from 'node:fs/promises';
import path from 'node:path';

export const MANIFEST_FILE = '.snappy-manifest.json';

/**
 * Reads the file list the previous run wrote. A missing or malformed manifest simply
 * disables pruning, so an older output directory can be upgraded safely.
 */
export async function readPruneManifest(dir) {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(dir, MANIFEST_FILE), 'utf8'));
    return Array.isArray(parsed.files) ? parsed.files : null;
  } catch {
    return null;
  }
}

/**
 * Deletes files the previous run generated that this run no longer produces, then
 * removes emptied route directories. Only paths recorded in the manifest are touched,
 * so assets and files the user added are never at risk.
 */
export async function pruneStaleFiles({ dir, previous, current, log }) {
  if (!Array.isArray(previous)) return [];
  const keep = new Set(current);
  const root = path.resolve(dir);
  const removed = [];
  for (const file of previous) {
    if (typeof file !== 'string' || keep.has(file)) continue;
    if (file === MANIFEST_FILE || file === 'robots.txt') continue;
    const target = path.resolve(root, file);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) continue;
    try {
      await fs.rm(target, { force: true });
      removed.push(file);
      await removeEmptyParents(root, path.dirname(target));
    } catch (error) {
      log?.warn(`could not prune ${file}: ${error.message}`);
    }
  }
  return removed;
}

// Writes the manifest for the next run. Files that are not ours to own are excluded.
export async function writePruneManifest({ dir, files }) {
  const owned = [...new Set(files)].filter(
    (file) => file !== MANIFEST_FILE && file !== 'robots.txt',
  );
  const contents = `${JSON.stringify({ version: 1, files: owned.sort() }, null, 2)}\n`;
  await fs.writeFile(path.join(dir, MANIFEST_FILE), contents, 'utf8');
}

// Removes parent directories that became empty, stopping at the output root.
async function removeEmptyParents(root, start) {
  let current = start;
  while (current !== root && current.startsWith(`${root}${path.sep}`)) {
    try {
      await fs.rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}
