import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Prepares the directory the run writes into. When a destination is configured the
 * built output is copied there first, so assets are present next to the generated
 * HTML and the source directory stays untouched. Returns the directory to serve.
 */
export async function prepareDestination({ sourceDir, destination, log }) {
  if (!destination || path.resolve(destination) === path.resolve(sourceDir)) {
    return sourceDir;
  }
  await copyTree(sourceDir, destination);
  log?.debug(`copied ${sourceDir} to ${destination}`);
  return destination;
}

/**
 * Recursively copies a directory tree. Implemented directly rather than with
 * fs.cp so behaviour does not depend on an experimental Node API.
 */
async function copyTree(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}
