import fs from 'node:fs/promises';
import path from 'node:path';
import { mapLimit } from './scheduler.js';

const COPY_CONCURRENCY = 8;

/**
 * Prepares the directory the run writes into. When a destination is configured the
 * built output is copied there first, so assets are present next to the generated
 * HTML and the source directory stays untouched. An existing destination is reported
 * before it is overwritten, and entries that cannot be copied are counted.
 */
export async function prepareDestination({
  sourceDir,
  destination,
  log,
  cleanDestination = false,
}) {
  if (!destination) return path.resolve(sourceDir);
  const source = path.resolve(sourceDir);
  const target = path.resolve(destination);
  if (target === source) return source;
  if (target.startsWith(`${source}${path.sep}`)) {
    throw new Error(
      `destination cannot be inside sourceDir: ${target} is inside ${source}. Use a sibling directory.`,
    );
  }
  if (cleanDestination) {
    const sourceInsideTarget = path.relative(target, source);
    if (
      sourceInsideTarget.length > 0 &&
      !sourceInsideTarget.startsWith('..') &&
      !path.isAbsolute(sourceInsideTarget)
    ) {
      throw new Error(
        `cleanDestination would delete sourceDir: ${source} is inside ${target}. Choose a destination outside the build output.`,
      );
    }
    await fs.rm(target, { recursive: true, force: true });
    log?.debug(`cleaned destination ${destination}`);
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
  const { results, errors } = await mapLimit(entries, COPY_CONCURRENCY, async (entry) => {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) return copyTree(from, to);
    if (!entry.isFile()) return 1;
    const [sourceStats, targetStats] = await Promise.all([
      fs.stat(from),
      fs.stat(to).catch(() => null),
    ]);
    if (
      targetStats?.isFile() &&
      targetStats.size === sourceStats.size &&
      targetStats.mtimeMs === sourceStats.mtimeMs
    ) {
      return 0;
    }
    await fs.copyFile(from, to);
    await fs.utimes(to, sourceStats.atime, sourceStats.mtime);
    return 0;
  });
  if (errors.length > 0) throw errors[0].error;
  return results.reduce((total, skipped) => total + (skipped ?? 0), 0);
}
