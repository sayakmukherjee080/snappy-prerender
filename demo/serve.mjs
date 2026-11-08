import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDemoServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const portArg = process.argv.indexOf('--port');
const port = Number(portArg === -1 ? (process.env.PORT ?? 4180) : process.argv[portArg + 1]);

const { server, origin } = await startDemoServer({ root: path.join(here, 'site'), port });

process.stdout.write(`Serving snappy demo on ${origin}\n`);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
