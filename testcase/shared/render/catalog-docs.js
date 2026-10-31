import { DOC_SECTION_PATHS, DOC_SECTIONS, DOCS, getDoc } from '../content/catalog/docs.js';
import {
  breadcrumbs,
  codeBlock,
  contentSections,
  esc,
  pageIntro,
  relatedLinks,
  slugify,
} from './base.js';

export function docsLayout({ content, path, doc }) {
  const pagerIndex = doc
    ? DOCS.findIndex((item) => item.slug === doc.slug && item.section === doc.section)
    : -1;
  const previous = pagerIndex > 0 ? DOCS[pagerIndex - 1] : null;
  const next = pagerIndex >= 0 && pagerIndex < DOCS.length - 1 ? DOCS[pagerIndex + 1] : null;

  return `<div class="docs-frame">
  <aside class="docs-sidebar">
    <div class="docs-sidebar__head">
      <p class="mono-label">Documentation</p>
      <label class="docs-search"><span class="sr-only">Search documentation</span><input type="search" placeholder="Filter docs…" autocomplete="off" data-island="docs-search" data-filter-target=".docs-nav a" /></label>
    </div>
    <nav class="docs-nav" aria-label="Documentation">${DOC_SECTIONS.map((section) => {
      const items = DOCS.filter((item) => item.section === section);
      if (items.length === 0) return '';
      return `<div class="docs-nav__group"><p class="docs-nav__label">${esc(section)}</p><ul>${items
        .map((item) => {
          const to = `/docs/${DOC_SECTION_PATHS[item.section]}/${item.slug}`;
          return `<li><a href="${esc(to)}"${path === to ? ' aria-current="page"' : ''}>${esc(
            item.title,
          )}</a></li>`;
        })
        .join('')}</ul></div>`;
    }).join('')}</nav>
  </aside>
  <div class="docs-content">
    ${breadcrumbs(doc ? [{ label: 'Docs', to: '/docs' }, { label: doc.section }, { label: doc.title }] : [])}
    ${content}
    ${
      previous || next
        ? `<nav class="docs-pager" aria-label="Docs pagination">
      ${previous ? `<a href="/docs/${DOC_SECTION_PATHS[previous.section]}/${previous.slug}"><span class="mono-label">Previous</span><strong>${esc(previous.title)}</strong></a>` : '<span></span>'}
      ${next ? `<a href="/docs/${DOC_SECTION_PATHS[next.section]}/${next.slug}"><span class="mono-label">Next</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
    </nav>`
        : ''
    }
  </div>
  <aside class="docs-toc">${
    doc
      ? `<p class="mono-label">On this page</p><ul>${doc.sections
          .map(
            (section) =>
              `<li><a href="#${esc(slugify(section.title))}">${esc(section.title)}</a></li>`,
          )
          .join('')}</ul><p class="docs-toc__updated">Updated ${esc(doc.updated)}</p>`
      : ''
  }</aside>
</div>`;
}

/**
 * Renders the lab sidebar around a lab page.
 * @param {{ content: string, path: string }} options
 * @returns {string}
 */

export function docsIndexPage() {
  return `<article class="docs-index">
  ${pageIntro({
    eyebrow: 'Docs / Index',
    title: 'The orbital inference manual.',
    summary:
      'Quickstart, API references, SDKs, and the changelog. Every page is reachable from the command palette too.',
    meta: [
      { label: 'Pages', value: String(DOCS.length) },
      { label: 'API', value: 'v1' },
      { label: 'Updated', value: 'Weekly' },
    ],
  })}
  <div class="shell docs-index__body">
    <div class="docs-index__controls">
      <label class="docs-search docs-search--wide"><span class="sr-only">Search documentation</span><input type="search" placeholder="Search guides, API references, and changelogs…" autocomplete="off" data-filter-input data-filter-target=".docs-card" /></label>
      <fieldset class="docs-filters" aria-label="Documentation section" data-filter-group-control>${[
        'All',
        ...DOC_SECTIONS,
      ]
        .map(
          (item, index) =>
            `<button type="button" aria-pressed="${index === 0}" data-filter-group-option="${esc(item)}">${esc(
              item,
            )}</button>`,
        )
        .join('')}</fieldset>
    </div>
    <p class="docs-index__count" aria-live="polite" data-filter-count>${DOCS.length} pages</p>
    <div class="docs-grid" data-filter-list>${DOCS.map(
      (doc) =>
        `<a class="docs-card" href="/docs/${DOC_SECTION_PATHS[doc.section]}/${doc.slug}" data-filter-item data-filter-group="${esc(
          doc.section,
        )}" data-filter-text="${esc(`${doc.title} ${doc.summary} ${doc.section}`)}"><span class="docs-card__section">${esc(
          doc.section,
        )}</span><h2>${esc(doc.title)}</h2><p>${esc(doc.summary)}</p><span class="docs-card__meta">Updated ${
          doc.updated
        } <span aria-hidden="true">→</span></span></a>`,
    ).join('')}</div>
    <p class="docs-index__empty" data-filter-empty hidden>No page matches that search. Try “handoff”, “streaming”, or “changelog”.</p>
  </div>
</article>`;
}

/**
 * Renders a docs article with sections, optional code, and related links.
 * @param {string} section
 * @param {string} slug
 * @returns {string}
 */
export function docPage(section, slug) {
  const doc = getDoc(section, slug);
  if (!doc) return notFoundPage();
  return `<article class="docs-article">
  ${pageIntro({
    eyebrow: `Docs / ${doc.section}`,
    title: esc(doc.title),
    summary: doc.summary,
    meta: [
      { label: 'Section', value: doc.section },
      { label: 'Updated', value: doc.updated },
      { label: 'API', value: 'v1' },
    ],
  })}
  <div class="shell docs-article__body">
    ${contentSections(doc.sections, doc)}
    ${doc.code ? codeBlock(`${doc.slug}.sh`, doc.code) : ''}
    ${relatedLinks(doc.related)}
  </div>
</article>`;
}

/**
 * Renders the blog or mission-log index.
 * @param {'blog' | 'mission'} kind
 * @returns {string}
 */
