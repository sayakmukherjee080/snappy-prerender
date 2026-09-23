import path from 'node:path';
import { prerender } from './core/run.js';

/**
 * Decides whether a build should be prerendered at all. Skipped for SSR, library
 * and non-writing builds, and for any environment other than the client one so a
 * multi-environment build cannot run the prerenderer more than once.
 */
export function shouldPrerender(viteConfig, environmentName) {
  if (!viteConfig) return false;
  if (viteConfig.build.ssr || viteConfig.build.lib || viteConfig.build.write === false) {
    return false;
  }
  if (environmentName && environmentName !== 'client') return false;
  return true;
}

/**
 * Vite plugin wrapper around the prerenderer. Runs after the client build has been
 * written, prerenders the output directory, and fails the build when rendering or
 * hydration verification fails.
 */
export default function snappyPrerender(options = {}) {
  let viteConfig = null;
  let done = false;
  return {
    name: 'snappy-prerender',
    apply: 'build',
    configResolved(config) {
      viteConfig = config;
    },
    async closeBundle() {
      if (done || !shouldPrerender(viteConfig, this.environment?.name)) return;
      done = true;

      const report = await prerender({
        sourceDir: path.resolve(viteConfig.root, viteConfig.build.outDir),
        base: viteConfig.base,
        ...options,
      });
      if (!report.ok) {
        const hydrationFailed = report.verification && !report.verification.ok;
        throw new Error(
          `snappy-prerender failed: ${report.errors.length} route error(s)${hydrationFailed ? ', hydration verification failed' : ''}`,
        );
      }
    },
  };
}
