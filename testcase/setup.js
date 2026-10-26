#!/usr/bin/env node
// First-run installer for the Aether Compute site. It verifies the Node runtime, installs the
// pinned front-end dependencies, and records a lock file so a second run cannot reinstall.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const lockPath = join(projectRoot, '.install.lock');
const requiredMajor = 20;

if (existsSync(lockPath)) {
  console.log('This project is already installed (.install.lock exists).');
  console.log('Run `npm run dev` to start the site, or remove the lock file to reinstall.');
  process.exit(1);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(nodeMajor) || nodeMajor < requiredMajor) {
  console.error(`Node ${requiredMajor}+ is required. Current version: ${process.versions.node}.`);
  process.exit(1);
}

// The site has no database, credentials, or runtime configuration, so there are no prompts and
// no .env file to write. The only setup step is installing the pinned dependencies.
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npmCommand, ['install'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (install.error) {
  console.error(`Could not start npm: ${install.error.message}`);
  process.exit(1);
}

if (install.status !== 0) {
  console.error('Dependency installation failed. Fix the error above and run setup again.');
  process.exit(1);
}

writeFileSync(lockPath, `Installed ${new Date().toISOString()}\n`);
console.log('Setup complete. Run `npm run dev` and open the URL printed by Vite.');
