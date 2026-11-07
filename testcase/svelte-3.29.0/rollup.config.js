import resolve from '@rollup/plugin-node-resolve';
import postcssImport from 'postcss-import';
import postcss from 'rollup-plugin-postcss';
import svelte from 'rollup-plugin-svelte';

export default {
  input: 'src/main.js',
  output: {
    dir: 'dist/assets',
    format: 'es',
    entryFileNames: 'main.js',
    assetFileNames: '[name][extname]',
  },
  plugins: [
    svelte(),
    resolve({ browser: true, extensions: ['.mjs', '.js', '.svelte'] }),
    postcss({
      extract: 'site.css',
      minimize: false,
      plugins: [postcssImport()],
    }),
  ],
};
