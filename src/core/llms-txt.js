import { matchesPattern, normaliseRoute, toPublicPath } from './routes.js';
import { pagePath } from './url-policy.js';

const MAIN_SECTION = 'Main';
const ACRONYMS = {
  api: 'API',
  faq: 'FAQ',
  llm: 'LLM',
  llms: 'LLMs',
  rss: 'RSS',
  sdk: 'SDK',
  seo: 'SEO',
  ui: 'UI',
  ux: 'UX',
};

/**
 * Builds the llms.txt document from the pages a run wrote. Routes are grouped by their
 * first path segment, links use the same page-path policy as canonical URLs, and pages
 * that are noindex or the not-found document are omitted.
 * @param {{ files: object[], config: object }} input
 * @returns {{ contents: string, file: string, routes: number, sections: object[], urls: string[] } | null}
 */
export function buildLlmsTxt({ files, config }) {
  const options = config.llmsTxt;
  const notFound = config.notFoundRoute ? normaliseRoute(config.notFoundRoute) : null;
  const siteUrl = config.metadata?.siteUrl?.replace(/\/$/, '') ?? null;
  const entries = [];
  const seen = new Set();
  for (const file of files) {
    if (!file.file?.endsWith('.html') || !file.route) continue;
    if (file.noindex) continue;
    const route = normaliseRoute(file.route);
    if (notFound && route === notFound) continue;
    if (seen.has(route) || !routeSelected(route, options)) continue;
    seen.add(route);
    const url = pageUrl(file, route, siteUrl, config);
    if (!url) continue;
    entries.push({
      route,
      url,
      title: pageTitle(file, route),
      description: pageDescription(file),
    });
  }
  if (entries.length === 0) return null;
  entries.sort((left, right) => left.route.localeCompare(right.route));
  const limited = Number.isInteger(options.maxRoutes)
    ? entries.slice(0, options.maxRoutes)
    : entries;
  if (limited.length === 0) return null;
  const sections = groupSections(limited);
  const home = entries.find((entry) => entry.route === '/');
  const described = entries.find((entry) => entry.description);
  const siteTitle = config.metadata?.siteName?.trim() || null;
  const title = options.title ?? siteTitle ?? home?.title ?? entries[0]?.title ?? 'Site index';
  const description = options.description ?? home?.description ?? described?.description ?? null;
  return {
    contents: renderDocument({ title, description, sections }),
    file: options.file,
    routes: limited.length,
    sections: sections.map((section) => ({
      name: section.name,
      routes: section.entries.length,
    })),
    urls: limited.map((entry) => entry.url),
  };
}

// Applies the configured route allowlist and denylist.
function routeSelected(route, options) {
  if (
    options.include.length > 0 &&
    !options.include.some((pattern) => matchesPattern(route, pattern))
  ) {
    return false;
  }
  return !options.exclude.some((pattern) => matchesPattern(route, pattern));
}

// Resolves the public URL for one written page.
function pageUrl(file, route, siteUrl, config) {
  const localeUrl = file.localeUrl;
  if (localeUrl) {
    if (/^https?:\/\//i.test(localeUrl)) return localeUrl;
    const path = localeUrl.startsWith('/') ? localeUrl : `/${localeUrl}`;
    return siteUrl ? `${siteUrl}${path}` : path;
  }
  const path = pagePath(route, {
    flatOutput: config.flatOutput,
    trailingSlash: config.metadata?.trailingSlash,
  });
  const publicPath = toPublicPath(path, config.base);
  return siteUrl ? `${siteUrl}${publicPath}` : publicPath;
}

// Reads a page title, falling back to a readable route segment.
function pageTitle(file, route) {
  const title = file.meta?.title;
  if (typeof title === 'string' && title.trim().length > 0) return title.trim();
  if (route === '/') return 'Home';
  const segment = route.split('/').filter(Boolean).at(-1) ?? route;
  return humanize(segment);
}

// Reads a page description as a single line.
function pageDescription(file) {
  const description = file.meta?.description;
  if (typeof description !== 'string') return null;
  return collapse(description);
}

// Groups routes under their first path segment.
function groupSections(entries) {
  const sections = new Map();
  for (const entry of entries) {
    const name = sectionName(entry.route);
    const current = sections.get(name) ?? [];
    current.push(entry);
    sections.set(name, current);
  }
  return [...sections.entries()]
    .map(([name, sectionEntries]) => ({ name, entries: sectionEntries }))
    .sort((left, right) => {
      if (left.name === MAIN_SECTION) return -1;
      if (right.name === MAIN_SECTION) return 1;
      return left.name.localeCompare(right.name);
    });
}

// Derives a section label from the first route segment.
function sectionName(route) {
  if (route === '/') return MAIN_SECTION;
  const segment = route.split('/').filter(Boolean)[0];
  return segment ? humanize(segment) : MAIN_SECTION;
}

// Turns a path segment into a readable label.
function humanize(segment) {
  let text = segment;
  try {
    text = decodeURIComponent(segment);
  } catch {
    // Keep the original segment when it is not valid escape syntax.
  }
  return text
    .split(/[-_]+/)
    .filter(Boolean)
    .map(
      (part) => ACRONYMS[part.toLowerCase()] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ');
}

// Serialises the document in the llms.txt shape.
function renderDocument({ title, description, sections }) {
  const lines = [`# ${escapeText(title)}`, ''];
  if (description) lines.push(`> ${escapeText(description)}`, '');
  for (const section of sections) {
    lines.push(`## ${escapeText(section.name)}`, '');
    for (const entry of section.entries) {
      const suffix = entry.description ? `: ${escapeText(entry.description)}` : '';
      lines.push(`- [${escapeText(entry.title)}](${escapeUrl(entry.url)})${suffix}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

// Collapses whitespace and escapes characters that change link text.
function escapeText(value) {
  return collapse(String(value)).replace(/([\\[\]])/g, '\\$1');
}

// Escapes the characters that would terminate a Markdown link destination.
function escapeUrl(value) {
  let url = String(value);
  try {
    url = encodeURI(url);
  } catch {
    // Keep the original URL when it cannot be encoded.
  }
  return url
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
    .replaceAll('[', '%5B')
    .replaceAll(']', '%5D')
    .replaceAll(' ', '%20');
}

// Collapses every run of whitespace to one space.
function collapse(value) {
  return value.replace(/\s+/g, ' ').trim();
}
