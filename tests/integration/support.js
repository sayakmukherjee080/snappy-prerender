import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(here, '..', '..');
export const cliPath = path.join(repoRoot, 'src', 'cli.js');

const tempDirs = [];

// Runs the CLI in a child process so a test server stays responsive.
export function runCli(args, { cwd = repoRoot } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('exit', (status) => resolve({ status, stdout, stderr }));
  });
}

// Removes every directory created by makeStaticSite for the current test file.
export async function cleanup() {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
  tempDirs.length = 0;
}

/**
 * Creates a throwaway static site from a file map. Used by the feature suites so a
 * browser run does not need a bundler.
 */
export async function makeStaticSite(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-feature-'));
  tempDirs.push(dir);
  for (const [name, html] of Object.entries(files)) {
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html);
  }
  return dir;
}

// Builds a minimal solid-colour PNG. Chrome only treats images with a real intrinsic size
// as LCP candidates, so fixtures need a genuine raster image rather than a scaled 1x1.
export function solidPng(width, height, [red, green, blue] = [255, 99, 71]) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = red;
    row[2 + x * 3] = green;
    row[3 + x * 3] = blue;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Standard CRC-32 used by PNG chunks.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Builds a minimal page with a title, heading, and links.
export function page(title, links = [], head = '') {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('');
  return `<!doctype html><html><head><title>${title}</title>${head}</head><body><h1>${title}</h1>${anchors}</body></html>`;
}
