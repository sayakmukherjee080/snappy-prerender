import babel from '@babel/core';
import solid from 'babel-preset-solid';
import { defineConfig } from 'vite';

/**
 * Compiles Solid 0.20 JSX with the matching Babel preset.
 * @returns {import('vite').Plugin}
 */
function solidPlugin() {
  return {
    name: 'solid-0.20',
    async transform(code, id) {
      if (!id.endsWith('.jsx')) return null;
      const result = await babel.transformAsync(code, {
        filename: id,
        presets: [solid],
        babelrc: false,
        configFile: false,
        sourceMaps: true,
      });
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  esbuild: {
    jsx: 'preserve',
  },
  plugins: [solidPlugin()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
