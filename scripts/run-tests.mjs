import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Recursively collects *.test.js files so the runner works identically on Node 20
 * (no glob support in --test) and Node 22+, on Windows and POSIX alike.
 */
function collectTests(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTests(full));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) files.push(full);
  }
  return files;
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  process.stderr.write('usage: node scripts/run-tests.mjs <dir> [dir...]\n');
  process.exit(1);
}

const files = targets.flatMap((target) => collectTests(target)).sort();
if (files.length === 0) {
  process.stderr.write(`no test files found under: ${targets.join(', ')}\n`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
