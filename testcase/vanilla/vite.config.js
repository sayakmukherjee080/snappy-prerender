import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    allowedHosts: ['.trycloudflare.com'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
