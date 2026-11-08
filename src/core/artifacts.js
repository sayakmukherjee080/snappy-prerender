import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLlmsTxt } from './llms-txt.js';
import { writeFileIfChanged } from './output.js';
import { buildPreloadManifest } from './preload-manifest.js';
import { toPublicPath } from './routes.js';
import { buildSitemap, withSitemapDirective } from './sitemap.js';

/**
 * Writes the preload manifest: per route, the scripts and stylesheets the final HTML
 * references, as Link header values a host can serve for Early Hints or HTTP headers.
 */
export async function writePreloadManifest({ manifestEntries, outputDir, config, log, report }) {
  const manifest = buildPreloadManifest(manifestEntries, {
    ignoreForPreload: config.ignoreForPreload,
    base: config.base,
    flatOutput: config.flatOutput,
    trailingSlash: config.metadata?.trailingSlash,
    notFoundRoute: config.notFoundRoute,
  });
  const file = 'preload-manifest.json';
  const contents = `${JSON.stringify(manifest, null, 2)}\n`;
  if (config.dryRun) {
    report.files.push({ route: null, file, status: 'dry-run', bytes: Buffer.byteLength(contents) });
    log.info(`Dry run: would write preload manifest covering ${manifest.length} route(s)`);
    return { file, routes: manifest.length, status: 'dry-run' };
  }
  const written = await writeFileIfChanged({ dir: outputDir, file, contents });
  report.files.push({ route: null, ...written });
  log.info(
    `${written.status === 'unchanged' ? 'Unchanged' : 'Wrote'} preload manifest covering ${manifest.length} route(s)`,
  );
  return { file, routes: manifest.length, status: written.status };
}

/**
 * Writes sitemap.xml from the routes the run produced, and points an existing robots.txt at
 * it. Every loc must be absolute, which is why the option needs metadata.siteUrl.
 */
export async function writeSitemap({ outputDir, config, log, report }) {
  if (config.saveAs !== 'html') {
    log.warn(
      `sitemap is skipped when saveAs writes ${config.saveAs} files, as there are no pages to list`,
    );
    return;
  }
  const sitemap = buildSitemap({ files: report.files, config });
  if (!sitemap) {
    log.warn('sitemap is skipped: no pages were written');
    return;
  }

  const siteUrl = config.metadata.siteUrl.replace(/\/$/, '');
  const sitemapUrl = `${siteUrl}${toPublicPath('/sitemap.xml', config.base)}`;
  const robots = await fs.readFile(path.join(outputDir, 'robots.txt'), 'utf8').catch(() => null);
  const patched = robots === null ? null : withSitemapDirective(robots, sitemapUrl);
  const names = sitemap.files.map((entry) => entry.name);

  if (config.dryRun) {
    for (const entry of sitemap.files) {
      report.files.push({
        route: null,
        file: entry.name,
        status: 'dry-run',
        bytes: Buffer.byteLength(entry.contents),
      });
    }
    report.sitemap = {
      file: 'sitemap.xml',
      routes: sitemap.routes,
      lastmod: sitemap.lastmod ?? 0,
      robotsUpdated: patched !== null,
      files: names,
      locs: sitemap.locs,
    };
    log.info(`Dry run: would write ${names.join(', ')} listing ${sitemap.routes} route(s)`);
    return;
  }

  const statuses = [];
  for (const entry of sitemap.files) {
    const written = await writeFileIfChanged({
      dir: outputDir,
      file: entry.name,
      contents: entry.contents,
    });
    statuses.push(written.status);
    report.files.push({ route: null, ...written });
  }
  report.sitemap = {
    file: 'sitemap.xml',
    routes: sitemap.routes,
    lastmod: sitemap.lastmod ?? 0,
    robotsUpdated: patched !== null,
    files: names,
    locs: sitemap.locs,
  };
  log.info(
    `${statuses.every((status) => status === 'unchanged') ? 'Unchanged' : 'Wrote'} ${names.join(', ')} listing ${sitemap.routes} route(s)`,
  );

  if (robots === null) {
    log.info(`Add "Sitemap: ${sitemapUrl}" to a robots.txt so crawlers find it`);
    return;
  }
  if (patched !== null) {
    const written = await writeFileIfChanged({
      dir: outputDir,
      file: 'robots.txt',
      contents: patched,
    });
    report.files.push({ route: null, ...written });
    log.info('Added the sitemap location to robots.txt');
  }
}

/**
 * Writes the optional llms.txt route index from the pages the run produced. The file
 * is rebuilt on every run, including all-cached incremental runs, so it never needs a
 * separate cache entry.
 */
export async function writeLlmsTxt({ outputDir, config, log, report }) {
  if (config.saveAs !== 'html') {
    log.warn(`llmsTxt is skipped when saveAs writes ${config.saveAs} files`);
    return null;
  }
  const llms = buildLlmsTxt({ files: report.files, config });
  if (!llms) {
    log.warn('llmsTxt is skipped: no pages were written');
    return null;
  }
  const file = config.llmsTxt.file;
  if (config.dryRun) {
    report.files.push({
      route: null,
      file,
      status: 'dry-run',
      bytes: Buffer.byteLength(llms.contents),
    });
    log.info(`Dry run: would write ${file} listing ${llms.routes} route(s)`);
    return {
      file,
      routes: llms.routes,
      sections: llms.sections,
      urls: llms.urls,
      status: 'dry-run',
    };
  }
  const written = await writeFileIfChanged({ dir: outputDir, file, contents: llms.contents });
  report.files.push({ route: null, ...written });
  log.info(
    `${written.status === 'unchanged' ? 'Unchanged' : 'Wrote'} ${file} listing ${llms.routes} route(s)`,
  );
  return {
    file,
    routes: llms.routes,
    sections: llms.sections,
    urls: llms.urls,
    status: written.status,
  };
}
