#!/usr/bin/env node
// First-run installer for the Aether Compute site. It verifies the Node runtime, installs the
// pinned front-end dependencies, and records a lock file so a second run cannot reinstall.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const lockPath = join(projectRoot, '.install.lock');
const requiredMajor = 22;
const requiredMinor = 12;

if (existsSync(lockPath)) {
  console.log('This project is already installed (.install.lock exists).');
  console.log('Run `npm run dev` to start the site, or remove the lock file to reinstall.');
  process.exit(1);
}

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (
  !Number.isInteger(nodeMajor) ||
  nodeMajor < requiredMajor ||
  (nodeMajor === requiredMajor && nodeMinor < requiredMinor)
) {
  console.error(
    `Node ${requiredMajor}.${requiredMinor}+ is required. Current version: ${process.versions.node}.`,
  );
  process.exit(1);
}

const install = spawnSync('npm', ['install'], { cwd: projectRoot, stdio: 'inherit' });
if (install.status !== 0) {
  console.error('Dependency installation failed. Resolve the npm error above and rerun setup.');
  process.exit(install.status ?? 1);
}

writeFileSync(lockPath, `${new Date().toISOString()}\n`);
console.log('Installed. Run `npm run dev` to start the site.');
