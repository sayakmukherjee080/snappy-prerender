/**
 * Debugging:
 *   https://eslint.org/docs/latest/use/configure/debug
 *  ----------------------------------------------------
 *
 *   Print a file's calculated configuration
 *
 *     npx eslint --print-config path/to/file.js
 *
 *   Inspecting the config
 *
 *     npx eslint --inspect-config
 *
 */

import babelParser from '@babel/eslint-parser/experimental-worker';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import ember from 'eslint-plugin-ember/recommended';
import n from 'eslint-plugin-n';
import qunit from 'eslint-plugin-qunit';
import WarpDrive from 'eslint-plugin-warp-drive/recommended';
import globals from 'globals';

const esmParserOptions = {
  ecmaFeatures: { modules: true },
  ecmaVersion: 'latest',
};

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', '!**/.*']),
  js.configs.recommended,
  eslintConfigPrettier,
  ember.configs.base,
  ember.configs.gjs,
  ...WarpDrive,
  /**
   * https://eslint.org/docs/latest/use/configure/configuration-files#configuring-linter-options
   */
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
    },
  },
  {
    files: ['**/*.{js,gjs}'],
    languageOptions: {
      parserOptions: esmParserOptions,
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ...qunit.configs.recommended,
    files: ['tests/**/*-test.{js,gjs}'],
    plugins: {
      qunit,
    },
  },
  /**
   * CJS node files
   */
  {
    ...n.configs['flat/recommended-script'],
    files: ['**/*.cjs', 'config/**/*.js'],
    plugins: {
      n,
    },

    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
    },
  },
  /**
   * ESM node files
   */
  {
    ...n.configs['flat/recommended-module'],
    files: ['**/*.mjs'],
    plugins: {
      n,
    },

    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      parserOptions: esmParserOptions,
      globals: {
        ...globals.node,
      },
    },
  },
]);
