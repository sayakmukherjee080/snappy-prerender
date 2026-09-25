import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The fixture imports the head component from the repo source, which resolves its own
  // `react` import from the repo root. Deduping keeps a single copy: the fixture's React 18.
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { outDir: 'dist', emptyOutDir: true },
});
