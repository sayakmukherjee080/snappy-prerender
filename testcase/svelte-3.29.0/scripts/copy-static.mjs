import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
copyFileSync('index.html', 'dist/index.html');

mkdirSync('dist/assets', { recursive: true });
for (const file of readdirSync('public')) {
  copyFileSync(`public/${file}`, `dist/${file}`);
}
