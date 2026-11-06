import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DRIFT_FAILURE_STATUSES } from './config.js';
import { writeFileIfChanged } from './output.js';

export const BASELINE_VERSION = 1;
const META_FIELDS = ['title', 'description', 'canonical', 'robots', 'lang', 'h1Count'];
const STATUS_FIELDS = ['noindex', 'notFound'];
const TOOL_VERSION = JSON.parse(
  await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
).version;

/**
 * Reads the previous run's route baseline. A missing or malformed file is a normal
 * first-run state, not a build failure; the caller decides whether to warn.
 * @param {string} file
 * @returns {Promise<{ state: string, baseline: object | null }>}
 */
export async function readBaseline(file) {
  if (!file) return { state: 'missing', baseline: null };
  let contents;
  try {
    contents = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'missing', baseline: null };
    return { state: 'invalid', baseline: null };
  }
  let baseline;
  try {
    baseline = JSON.parse(contents);
  } catch {
    return { state: 'invalid', baseline: null };
  }
  if (!baseline || !Array.isArray(baseline.routes)) {
    return { state: 'invalid', baseline: null };
  }
  if (baseline.version !== BASELINE_VERSION) {
    return { state: 'version-mismatch', baseline };
  }
  return { state: 'ok', baseline };
}

/**
 * Writes the baseline atomically, leaving an identical file untouched.
 * @param {string} file
 * @param {object} baseline
 */
export async function writeBaseline(file, baseline) {
  const contents = `${JSON.stringify(baseline, null, 2)}\n`;
  return writeFileIfChanged({
    dir: path.dirname(file),
    file: path.basename(file),
    contents,
  });
}

/**
 * Reduces a written route record to the fields a baseline needs.
 * @param {object} detail
 * @returns {object}
 */
export function toDriftRecord(detail) {
  return {
    route: detail.route,
    file: detail.file,
    htmlHash: detail.htmlHash ?? null,
    contentHash: detail.contentHash ?? null,
    bytes: detail.bytes ?? 0,
    textLength: detail.textLength ?? 0,
    noindex: detail.noindex === true,
    notFound: detail.notFound === true,
    lastmod: detail.lastmod ?? null,
    meta: pickMeta(detail.meta),
  };
}

/**
 * Builds the serialisable baseline for the current route records.
 * @param {{ records: object[], config: object, buildTime: string, lastmods: Map<string, string> }} input
 */
export function buildBaseline({ records, config, buildTime, lastmods }) {
  const routes = records
    .map((record) => ({ ...record, lastmod: lastmods.get(record.file) ?? record.lastmod ?? null }))
    .sort((left, right) => left.file.localeCompare(right.file));
  return {
    version: BASELINE_VERSION,
    toolVersion: TOOL_VERSION,
    generatedAt: buildTime,
    scopeHash: scopeHash(config),
    routes,
  };
}

/**
 * Compares the previous baseline to the current run. The result is deliberately
 * data-only so the same comparison can be printed, serialised or asserted in tests.
 * @param {object[]} previousRoutes
 * @param {object[]} currentRoutes
 */
export function compareDrift(previousRoutes, currentRoutes) {
  const previous = [...previousRoutes].sort((left, right) => left.file.localeCompare(right.file));
  const current = [...currentRoutes].sort((left, right) => left.file.localeCompare(right.file));
  const previousByFile = new Map(previous.map((record) => [record.file, record]));
  const previousByRoute = new Map(previous.map((record) => [record.route, record]));
  const usedPrevious = new Set();
  const added = [];
  const removed = [];
  const moved = [];
  const changed = [];
  const htmlOnly = [];
  const statusChanged = [];
  let unchanged = 0;

  for (const record of current) {
    const before = previousByFile.get(record.file) ?? previousByRoute.get(record.route) ?? null;
    if (!before) {
      added.push({ route: record.route, file: record.file });
      continue;
    }
    usedPrevious.add(before.file);
    const movedFrom = before.file !== record.file || before.route !== record.route;
    const reasons = changeReasons(before, record);
    const contentReasons = reasons.filter((reason) => !STATUS_FIELDS.includes(reason));
    const statusReasons = reasons.filter((reason) => STATUS_FIELDS.includes(reason));

    if (movedFrom && contentReasons.length === 0 && statusReasons.length === 0) {
      moved.push({
        route: record.route,
        fromFile: before.file,
        toFile: record.file,
        fromRoute: before.route,
        toRoute: record.route,
      });
      continue;
    }
    if (contentReasons.length > 0) {
      changed.push({
        route: record.route,
        file: record.file,
        ...(movedFrom ? { fromFile: before.file, fromRoute: before.route } : {}),
        reasons,
        previous: snapshot(before),
        current: snapshot(record),
      });
      continue;
    }
    if (statusReasons.length > 0) {
      statusChanged.push({
        route: record.route,
        file: record.file,
        changes: statusChanges(before, record),
      });
      continue;
    }
    if (before.htmlHash !== record.htmlHash) {
      htmlOnly.push({ route: record.route, file: record.file });
      continue;
    }
    unchanged += 1;
  }

  for (const record of previous) {
    if (!usedPrevious.has(record.file)) removed.push({ route: record.route, file: record.file });
  }

  return {
    added,
    removed,
    moved,
    changed,
    htmlOnly,
    statusChanged,
    unchanged,
    summary: {
      previous: previous.length,
      current: current.length,
      added: added.length,
      removed: removed.length,
      moved: moved.length,
      changed: changed.length,
      htmlOnly: htmlOnly.length,
      statusChanged: statusChanged.length,
      unchanged,
    },
  };
}

/**
 * Assigns sitemap dates: content changes and new pages use the build time; unchanged,
 * moved and HTML-only changes keep the previous date.
 * @param {object[]} previousRoutes
 * @param {object[]} currentRoutes
 * @param {string} buildTime
 */
export function assignLastmods(previousRoutes, currentRoutes, buildTime) {
  const previousByFile = new Map(previousRoutes.map((record) => [record.file, record]));
  const previousByRoute = new Map(previousRoutes.map((record) => [record.route, record]));
  const lastmods = new Map();
  for (const record of currentRoutes) {
    const before = previousByFile.get(record.file) ?? previousByRoute.get(record.route) ?? null;
    if (!before) {
      lastmods.set(record.file, buildTime);
      continue;
    }
    const contentChanged = before.contentHash !== record.contentHash;
    const becameIndexable =
      (before.noindex === true || before.notFound === true) &&
      record.noindex !== true &&
      record.notFound !== true;
    lastmods.set(
      record.file,
      contentChanged || becameIndexable ? buildTime : (before.lastmod ?? buildTime),
    );
  }
  return lastmods;
}

/**
 * Builds the report section, baseline and lastmod map for one run. It treats a missing,
 * invalid or version-mismatched baseline as a new baseline instead of reporting every
 * route as added.
 * @param {{ previous: object, current: object[], config: object, buildTime: string }} input
 */
export function buildDriftResult({ previous, current, config, buildTime }) {
  const state = previous?.state ?? 'missing';
  const previousRoutes = previous?.baseline?.routes ?? [];
  const currentSorted = [...current].sort((left, right) => left.file.localeCompare(right.file));

  if (state !== 'ok') {
    const lastmods = assignLastmods([], currentSorted, buildTime);
    const baseline = buildBaseline({ records: currentSorted, config, buildTime, lastmods });
    return {
      report: emptyReport({
        file: config.baselinePath,
        state: state === 'missing' ? 'created' : state,
        generatedAt: previous?.baseline?.generatedAt ?? null,
        current: currentSorted.length,
        unchanged: currentSorted.length,
      }),
      baseline,
      lastmods,
      state,
    };
  }

  const comparison = compareDrift(previousRoutes, currentSorted);
  const lastmods = assignLastmods(previousRoutes, currentSorted, buildTime);
  const baseline = buildBaseline({ records: currentSorted, config, buildTime, lastmods });
  const failures = driftFailures(comparison, config.failOnDrift);
  return {
    report: {
      enabled: true,
      baseline: {
        file: config.baselinePath,
        state: 'compared',
        generatedAt: previous.baseline.generatedAt ?? null,
      },
      scopeChanged: previous.baseline.scopeHash !== scopeHash(config),
      ...comparison,
      failures,
      ok: failures.length === 0,
    },
    baseline,
    lastmods,
    state: 'compared',
  };
}

// Creates the empty comparison used when a new baseline is created.
function emptyReport({ file, state, generatedAt, current, unchanged }) {
  return {
    enabled: true,
    baseline: { file, state, generatedAt },
    scopeChanged: false,
    added: [],
    removed: [],
    moved: [],
    changed: [],
    htmlOnly: [],
    statusChanged: [],
    unchanged,
    summary: {
      previous: 0,
      current,
      added: 0,
      removed: 0,
      moved: 0,
      changed: 0,
      htmlOnly: 0,
      statusChanged: 0,
      unchanged,
    },
    failures: [],
    ok: true,
  };
}

// Reports the selected statuses that have at least one route.
function driftFailures(comparison, selected) {
  if (!selected || selected.length === 0) return [];
  const counts = {
    added: comparison.added.length,
    removed: comparison.removed.length,
    moved: comparison.moved.length,
    changed: comparison.changed.length,
    'html-only': comparison.htmlOnly.length,
    'status-changed': comparison.statusChanged.length,
  };
  return selected
    .filter((status) => DRIFT_FAILURE_STATUSES.includes(status) && counts[status] > 0)
    .map((status) => ({ status, count: counts[status] }));
}

// Lists the reasons a route changed, including metadata and sitemap status changes.
function changeReasons(before, current) {
  const reasons = [];
  if (before.contentHash !== current.contentHash) reasons.push('content');
  for (const field of META_FIELDS) {
    if ((before.meta?.[field] ?? null) !== (current.meta?.[field] ?? null)) reasons.push(field);
  }
  for (const field of STATUS_FIELDS) {
    if (before[field] !== current[field]) reasons.push(field);
  }
  return reasons;
}

// Describes the status fields that changed between two records.
function statusChanges(before, current) {
  return STATUS_FIELDS.filter((field) => before[field] !== current[field]).map((field) => ({
    field,
    from: before[field],
    to: current[field],
  }));
}

// Reduces a record to the values a changed-route report should expose.
function snapshot(record) {
  const meta = pickMeta(record.meta);
  return {
    contentHash: record.contentHash,
    htmlHash: record.htmlHash,
    bytes: record.bytes,
    textLength: record.textLength,
    noindex: record.noindex,
    notFound: record.notFound,
    ...Object.fromEntries(META_FIELDS.map((field) => [field, meta[field] ?? null])),
  };
}

// Keeps baseline metadata small and deterministic.
function pickMeta(meta = {}) {
  return Object.fromEntries(META_FIELDS.map((field) => [field, meta?.[field] ?? null]));
}

/**
 * Hashes the route-affecting configuration so a changed include list or base path is
 * visible as a scope change instead of being mistaken for pure content drift.
 * @param {object} config
 */
export function scopeHash(config) {
  const scope = {
    base: config.base,
    flatOutput: config.flatOutput,
    trailingSlash: config.metadata?.trailingSlash ?? null,
    include: scopePatterns(config.include),
    exclude: scopePatterns(config.exclude),
    maxRoutes: config.maxRoutes,
    notFoundRoute: config.notFoundRoute,
    routesFile: config.routesFile,
    routesFromSitemap: config.routesFromSitemap,
    locales: config.locales
      ? {
          mode: config.locales.mode,
          default: config.locales.default,
          xDefault: config.locales.xDefault,
          list: (config.locales.list ?? []).map((locale) => ({
            code: locale.code,
            prefix: locale.prefix,
            routes: locale.routes ?? null,
          })),
        }
      : null,
  };
  return createHash('sha256').update(stableStringify(scope)).digest('hex');
}

// Serialises include/exclude patterns, including RegExp values, deterministically.
function scopePatterns(patterns = []) {
  return patterns.map((pattern) =>
    pattern instanceof RegExp ? { regex: pattern.source, flags: pattern.flags } : String(pattern),
  );
}

// Sorts object keys recursively for a stable hash.
function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

// Recursively sorts object keys while preserving array order.
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}
