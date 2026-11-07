import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
  build: {
    target: 'es2017',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
