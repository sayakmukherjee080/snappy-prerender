import { auditLinks, auditOrphans } from './links.js';
import { auditMetadata } from './metadata.js';
import { auditSitemap } from './sitemap.js';

/**
 * Audits the written site and returns report-only findings. Errors are the things a
 * static site should not ship (broken links, sitemap disagreement, duplicate titles);
 * warnings cover metadata that is useful but legitimately optional.
 */
export async function auditRun({ report, config, outputDir }) {
  const errors = [];
  const warnings = [];
  const add = (severity, rule, message, details = {}) => {
    const finding = { rule, severity, message, ...details };
    if (severity === 'error') errors.push(finding);
    else warnings.push(finding);
  };

  const pages = report.routeDetails.filter((detail) => detail.file?.endsWith('.html'));
  auditRouteHealth({ report, add });
  auditMetadata({ pages, config, add });
  auditSitemap({ pages, config, report, add });
  const linkAudit = await auditLinks({ report, config, outputDir, add });
  auditOrphans({ pages, report, add });
  auditCspHygiene({ pages, config, report, add });
  removeDuplicateFindings({ errors, warnings });

  return {
    errors,
    warnings,
    linksChecked: linkAudit.checked,
  };
}

// Mirrors route-level failures into the audit so failOnAuditError covers route health
// without requiring callers to inspect a second collection.
function auditRouteHealth({ report, add }) {
  for (const error of report.errors ?? []) {
    add('error', 'route-error', error.message, { route: error.route ?? undefined });
  }
  if (report.truncated) {
    add(
      'error',
      'route-cap',
      `maxRoutes (${report.truncated.limit}) stopped the crawl after ${report.truncated.routes} route(s)`,
      { droppedRoutes: report.truncated.droppedRoutes ?? [] },
    );
  }
  for (const route of report.emptyPages ?? []) {
    add('error', 'empty-page', 'rendered an empty page', { route });
  }
  for (const group of report.duplicatePages ?? []) {
    for (const route of group.routes) {
      const others = group.routes.filter((other) => other !== route).join(', ');
      add('error', 'duplicate-output', `identical output to ${others}`, { route });
    }
  }
}

// Inline style attributes cannot be covered by a CSP hash, and browser console errors
// reveal assets the generated policy blocked.
function auditCspHygiene({ pages, config, report, add }) {
  if (config.csp !== 'hash') return;
  for (const route of report.cspSkipped ?? []) {
    add(
      'warning',
      'existing-csp-meta',
      `${route} already has a CSP meta, so no hashes were injected`,
      { route },
    );
  }
  const violations = new Map();
  const collect = (route, message) => {
    if (!/content security policy|violates the following/i.test(message)) return;
    const messages = violations.get(route) ?? new Set();
    messages.add(message);
    violations.set(route, messages);
  };
  for (const { route, message } of report.consoleErrors ?? []) collect(route, message);
  for (const page of pages) {
    for (const message of page.consoleErrors ?? []) collect(page.route, message);
  }
  for (const [route, messages] of violations) {
    add(
      'warning',
      'csp-console-violation',
      `${route} logged ${messages.size} Content-Security-Policy violation(s)`,
      { route },
    );
  }
  for (const page of pages) {
    if (page.meta?.inlineStyleAttributes > 0) {
      add(
        'warning',
        'inline-style-attributes',
        `${page.route} has ${page.meta.inlineStyleAttributes} inline style attribute(s); CSP hashes cannot cover them`,
        { route: page.route },
      );
    }
  }
}

// A finding can be produced by more than one check; keep the first copy.
function removeDuplicateFindings({ errors, warnings }) {
  for (const list of [errors, warnings]) {
    const seen = new Set();
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const finding = list[index];
      const key = `${finding.rule}|${finding.route ?? ''}|${finding.message}`;
      if (seen.has(key)) list.splice(index, 1);
      else seen.add(key);
    }
  }
}
