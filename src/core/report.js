import path from 'node:path';
import { writeFileIfChanged } from './output.js';

/**
 * Writes the machine-readable run report. The JSON is deliberately limited to route,
 * audit and artifact data; configuration and captured state are never serialised.
 */
export async function writeReport({ report, config, log }) {
  if (!config.reportPath) return null;
  const contents = `${JSON.stringify(buildReport(report, config), null, 2)}\n`;
  if (config.dryRun) {
    log.info(`Dry run: would write report to ${config.reportPath}`);
    return { file: config.reportPath, status: 'dry-run' };
  }
  const target = path.resolve(config.reportPath);
  const written = await writeFileIfChanged({
    dir: path.dirname(target),
    file: path.basename(target),
    contents,
  });
  log.info(`Wrote report to ${config.reportPath}`);
  return { file: config.reportPath, status: written.status };
}

/**
 * Shapes the public report document. `routes` here is an array of per-route records;
 * the programmatic `report.routes` stays a list of route strings. URLs are reduced to
 * origin and path, and the configured storage-state path is redacted everywhere, so a
 * report can be attached to a build log without leaking credentials or session data.
 */
export function buildReport(report, config = null) {
  const audit = report.audit ?? { errors: [], warnings: [], linksChecked: 0 };
  const document = {
    version: 1,
    generatedAt: new Date().toISOString(),
    durationMs: report.durationMs,
    timings: report.timings,
    ok: report.ok,
    clock: report.clock ?? null,
    locales: report.locales ?? null,
    seoLocale: report.seoLocale ?? null,
    summary: {
      routes: report.routeDetails.length,
      files: report.files.filter((file) => file.status !== 'dry-run').length,
      errors: uniqueErrorCount(report, audit),
      warnings: audit.warnings.length,
    },
    routes: report.routeDetails,
    verification: report.verification
      ? {
          ok: report.verification.ok,
          modes: report.verification.modes,
          frameworks: report.verification.frameworks,
          skipped: report.verification.skipped ?? 0,
          policySkipped: report.verification.policySkipped ?? 0,
          allowed: report.verification.allowed ?? 0,
          allowedRerender: report.verification.allowedRerender ?? 0,
          errors: report.verification.errors,
        }
      : null,
    audit,
    sitemap: report.sitemap,
    preloadManifest: report.preloadManifest,
    truncated: report.truncated,
    notFoundRoutes: report.notFoundRoutes,
    duplicateOutputs: report.duplicatePages,
    routeSources: report.routeSources ?? [],
    cspSkipped: report.cspSkipped ?? [],
    traces: report.traces ?? [],
  };
  return sanitiseValue(document, config);
}

// Counts route errors once even when the audit mirrors them as findings.
function uniqueErrorCount(report, audit) {
  const seen = new Set();
  for (const error of [...(report.errors ?? []), ...(audit.errors ?? [])]) {
    seen.add(`${error.route ?? ''}|${error.message ?? ''}`);
  }
  return seen.size;
}

// Recursively redacts URLs and the configured storage-state path from report strings.
function sanitiseValue(value, config) {
  if (Array.isArray(value)) return value.map((entry) => sanitiseValue(entry, config));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitiseValue(entry, config)]),
    );
  }
  if (typeof value !== 'string') return value;
  let text = value;
  if (config?.storageState) {
    for (const secret of [config.storageState, path.resolve(config.storageState)]) {
      if (text.includes(secret)) text = text.split(secret).join('[redacted]');
    }
  }
  if (!/https?:\/\//i.test(text)) return text;
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, redactUrl);
}

// Removes credentials, query strings and fragments from an absolute URL.
function redactUrl(raw) {
  const trailing = /[.,;)\]]+$/.exec(raw)?.[0] ?? '';
  const urlText = trailing ? raw.slice(0, -trailing.length) : raw;
  try {
    const url = new URL(urlText);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return `${url.href}${trailing}`;
  } catch {
    return raw;
  }
}
