import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { prerender } from '../src/core/index.js';

const parsed = parseArgs({
  options: {
    routes: { type: 'string' },
    concurrency: { type: 'string' },
    verify: { type: 'boolean' },
    'reuse-verification-context': { type: 'boolean' },
    audit: { type: 'boolean' },
    'preload-links': { type: 'boolean' },
    'preload-manifest': { type: 'boolean' },
    csp: { type: 'boolean' },
    'minify-html': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (parsed.values.help) {
  process.stdout.write(`Usage: npm run benchmark -- [options]

  --routes <n>            Routes to generate (default: 500)
  --concurrency <n>       Browser page concurrency (default: 8)
  --verify                Run hydration verification
  --reuse-verification-context  Reuse one verification context per worker
  --audit                 Run the site audit
  --preload-links         Inject preload links
  --preload-manifest      Write the preload manifest
  --csp                   Use CSP hash mode
  --minify-html           Minify output HTML
`);
  process.exit(0);
}

const routeCount = Number(parsed.values.routes ?? 500);
const concurrency = Number(parsed.values.concurrency ?? 8);
if (!Number.isInteger(routeCount) || routeCount < 1) throw new Error('routes must be positive');
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('concurrency must be positive');
}

const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-benchmark-'));
const routeList = [];
try {
  for (let index = 0; index < routeCount; index += 1) {
    const route = index === 0 ? '/' : `/route-${index}`;
    routeList.push(route);
    const file = index === 0 ? 'index.html' : path.join(`route-${index}`, 'index.html');
    const target = path.join(sourceDir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(
      target,
      `<!doctype html><html><head><title>Route ${index}</title></head><body><h1>Route ${index}</h1><p>Benchmark page</p></body></html>`,
    );
  }
  const routesFile = path.join(sourceDir, 'routes.txt');
  await fs.writeFile(routesFile, `${routeList.join('\n')}\n`);

  const startedAt = Date.now();
  const report = await prerender({
    sourceDir,
    routesFile,
    crawl: false,
    logLevel: 'silent',
    concurrency,
    verify: parsed.values.verify ?? false,
    reuseVerificationContext: parsed.values['reuse-verification-context'] ?? false,
    audit: parsed.values.audit ?? false,
    preloadLinks: parsed.values['preload-links'] ?? false,
    preloadManifest: parsed.values['preload-manifest'] ?? false,
    csp: parsed.values.csp ? 'hash' : 'off',
    minifyHtml: parsed.values['minify-html'] ?? false,
  });
  const wallMs = Date.now() - startedAt;
  process.stdout.write(
    `${JSON.stringify(
      {
        routes: routeCount,
        concurrency,
        wallMs,
        durationMs: report.durationMs,
        timings: report.timings,
        ok: report.ok,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await fs.rm(sourceDir, { recursive: true, force: true });
}
