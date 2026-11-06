import path from 'node:path';

// Warns when a baseline would be deleted by cleanDestination or published with the site.
export function warnBaselineLocation(file, outputDir, log) {
  const root = path.resolve(outputDir);
  const target = path.resolve(file);
  if (target === root || target.startsWith(`${root}${path.sep}`)) {
    log.warn(
      `baselinePath is inside the output directory (${file}); cleanDestination could delete it and a static host could serve it. Prefer a path outside the build output.`,
    );
  }
}

// Creates the report section used when drift cannot run.
export function skippedDrift(config, reason, previous) {
  return {
    enabled: true,
    baseline: {
      file: config.baselinePath,
      state: previous?.state ?? 'missing',
      generatedAt: previous?.baseline?.generatedAt ?? null,
    },
    skipped: reason,
    scopeChanged: false,
    added: [],
    removed: [],
    moved: [],
    changed: [],
    htmlOnly: [],
    statusChanged: [],
    unchanged: 0,
    summary: {
      previous: 0,
      current: 0,
      added: 0,
      removed: 0,
      moved: 0,
      changed: 0,
      htmlOnly: 0,
      statusChanged: 0,
      unchanged: 0,
    },
    failures: [],
    ok: true,
  };
}

// Adds the per-route drift status to the JSON route records.
export function applyDriftDetails(report, drift) {
  const details = new Map(report.routeDetails.map((detail) => [detail.file, detail]));
  for (const detail of report.routeDetails) {
    detail.driftStatus = 'unchanged';
    detail.driftReasons = [];
  }
  for (const entry of drift.added) {
    const detail = details.get(entry.file);
    if (detail) detail.driftStatus = 'added';
  }
  for (const entry of drift.moved) {
    const detail = details.get(entry.toFile);
    if (detail) detail.driftStatus = 'moved';
  }
  for (const entry of drift.changed) {
    const detail = details.get(entry.file);
    if (detail) {
      detail.driftStatus = 'changed';
      detail.driftReasons = entry.reasons;
    }
  }
  for (const entry of drift.htmlOnly) {
    const detail = details.get(entry.file);
    if (detail) detail.driftStatus = 'html-only';
  }
  for (const entry of drift.statusChanged) {
    const detail = details.get(entry.file);
    if (detail) {
      detail.driftStatus = 'status-changed';
      detail.driftReasons = entry.changes.map((change) => change.field);
    }
  }
}

// Applies lastmod dates to route details and the files sitemap generation reads.
export function applyLastmods(report, lastmods) {
  for (const detail of report.routeDetails) {
    if (lastmods.has(detail.file)) detail.lastmod = lastmods.get(detail.file);
  }
  for (const file of report.files) {
    if (file.file && lastmods.has(file.file)) file.lastmod = lastmods.get(file.file);
  }
}

// Preserves previous dates when an incomplete run cannot compare current content.
export function applyPreviousLastmods(report, previous) {
  const routes = previous?.baseline?.routes ?? [];
  if (routes.length === 0) return;
  applyLastmods(report, new Map(routes.map((route) => [route.file, route.lastmod])));
}

// Prints a compact drift summary and any gate failures.
export function logDrift(drift, config, log) {
  const state = drift.baseline?.state;
  if (state === 'created') {
    log.info(`Created drift baseline at ${config.baselinePath}`);
  } else if (state === 'invalid' || state === 'version-mismatch') {
    log.warn(
      `Drift baseline at ${config.baselinePath} is ${state}; it will be replaced after this run`,
    );
  } else if (state === 'write-failed') {
    log.error('Drift baseline could not be written');
  } else {
    const summary = drift.summary;
    log.info(
      `Drift: ${summary.added} added, ${summary.removed} removed, ${summary.changed} changed, ${summary.unchanged} unchanged`,
    );
    if (summary.htmlOnly > 0) log.info(`Drift: ${summary.htmlOnly} route(s) changed HTML only`);
    if (drift.scopeChanged) log.warn('Drift scope changed (include, base or locale configuration)');
    if (drift.failures.length > 0) {
      log.error(
        `Drift gate failed: ${drift.failures.map((failure) => `${failure.status} (${failure.count})`).join(', ')}`,
      );
    }
  }
}
