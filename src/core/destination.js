import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Prepares the directory the run writes into. When a destination is configured the
 * built output is copied there first, so assets are present next to the generated
 * HTML and the source directory stays untouched. An existing destination is reported
 * before it is overwritten, and entries that cannot be copied are counted.
 */
export async function prepareDestination({ sourceDir, destination, log }) {
  if (!destination || path.resolve(destination) === path.resolve(sourceDir)) {
    return sourceDir;
  }
  const existing = await fs.readdir(destination).catch(() => []);
  if (existing.length > 0) {
    log?.warn(
      `destination ${destination} is not empty (${existing.length} entries); existing files may be overwritten`,
    );
  }
  const skipped = await copyTree(sourceDir, destination);
  if (skipped > 0) {
    log?.warn(`skipped ${skipped} non-file entr(ies) while copying ${sourceDir} to ${destination}`);
  }
  log?.debug(`copied ${sourceDir} to ${destination}`);
  return destination;
}

/**
 * Recursively copies a directory tree. Implemented directly rather than with
 * fs.cp so behaviour does not depend on an experimental Node API. Returns how many
 * entries were skipped because they are neither files nor directories, such as symlinks.
 */
async function copyTree(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  let skipped = 0;
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) skipped += await copyTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
    else skipped += 1;
  }
  return skipped;
}
