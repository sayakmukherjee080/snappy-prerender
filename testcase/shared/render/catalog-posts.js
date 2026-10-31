import { BLOG_POSTS, MISSION_LOG } from '../content/catalog/blog.js';
import { CUSTOMERS, getCustomer } from '../content/catalog/customers.js';
import { getLegalPage, LEGAL_PAGES } from '../content/catalog/legal.js';
import { contentSections, esc, pageIntro, relatedLinks, slugify } from './base.js';

export function blogIndexPage(kind) {
  const isMission = kind === 'mission';
  const items = isMission ? MISSION_LOG : BLOG_POSTS;
  const basePath = isMission ? '/mission-log' : '/blog';
  const categories = ['All', ...new Set(items.map((item) => item.category))];

  return `<article class="catalog-index">
  ${pageIntro({
    eyebrow: isMission ? 'Mission log / Index' : 'Blog / Index',
    title: isMission ? 'Notes from the constellation.' : 'Field notes from orbit.',
    summary: isMission
      ? 'Short operational notes from the constellation: handoffs, station acceptance, and anomalies.'
      : 'Latency, ground segments, radiation, and the engineering behind the orbital inference network.',
    meta: [
      { label: 'Entries', value: String(items.length) },
      { label: 'Categories', value: String(categories.length - 1) },
      { label: 'Updated', value: '2026-10' },
    ],
  })}
  <div class="shell docs-index__body">
    <div class="docs-index__controls">
      <label class="docs-search docs-search--wide"><span class="sr-only">Search entries</span><input type="search" placeholder="${
        isMission ? 'Search the mission log…' : 'Search field notes…'
      }" autocomplete="off" data-filter-input data-filter-target=".post-card" /></label>
      <fieldset class="docs-filters" aria-label="Category" data-filter-group-control>${categories
        .map(
          (item, index) =>
            `<button type="button" aria-pressed="${index === 0}" data-filter-group-option="${esc(
              item,
            )}">${esc(item)}</button>`,
        )
        .join('')}</fieldset>
    </div>
    <p class="docs-index__count" aria-live="polite" data-filter-count>${items.length} entries</p>
    <div class="post-grid" data-filter-list>${items
      .map(
        (post) =>
          `<a class="post-card" href="${basePath}/${post.slug}" data-filter-item data-filter-group="${esc(
            post.category,
          )}" data-filter-text="${esc(`${post.title} ${post.excerpt} ${post.category}`)}"><div class="post-card__meta"><span>${
            post.date
          }</span><span>${esc(post.category)}</span><span>${esc(
            post.readTime,
          )}</span></div><h2>${esc(post.title)}</h2><p>${esc(
            post.excerpt,
          )}</p><span class="catalog-card__meta">Read <span aria-hidden="true">→</span></span></a>`,
      )
      .join('')}</div>
    <p class="docs-index__empty" data-filter-empty hidden>No entry matches that search. Try another category.</p>
  </div>
</article>`;
}

/**
 * Renders a blog post or mission-log entry.
 * @param {'blog' | 'mission'} kind
 * @param {string} slug
 * @returns {string}
 */
export function blogPostPage(kind, slug) {
  const isMission = kind === 'mission';
  const post = (isMission ? MISSION_LOG : BLOG_POSTS).find((item) => item.slug === slug);
  if (!post) return notFoundPage();

  return `<article class="post-page">
  ${pageIntro({
    eyebrow: isMission ? `Mission log / ${post.date}` : `Blog / ${post.category}`,
    title: esc(post.title),
    summary: post.excerpt,
    meta: [
      { label: 'Date', value: post.date },
      { label: 'Category', value: post.category },
      { label: 'Read', value: post.readTime },
    ],
    badge: { label: post.author, tone: 'neutral' },
  })}
  <div class="shell post-page__body">
    ${contentSections(post.sections, post)}
    ${relatedLinks(post.related)}
  </div>
</article>`;
}

/**
 * Renders a simple catalog index page.
 * @param {object} options
 * @returns {string}
 */
function simpleIndex({ eyebrow, title, summary, meta, items, kind, metaLine }) {
  return `<article class="catalog-index">
  ${pageIntro({ eyebrow, title, summary, meta })}
  <div class="shell catalog-grid">${items
    .map(
      (item) =>
        `<a class="catalog-card" href="/${kind}/${item.slug}"><span class="catalog-card__eyebrow">${esc(
          item.badge,
        )}</span><h2>${esc(item.title)}</h2><p>${esc(
          item.summary,
        )}</p><span class="catalog-card__meta">${metaLine(item)} <span aria-hidden="true">→</span></span></a>`,
    )
    .join('')}</div>
</article>`;
}

/**
 * Renders the customers index.
 * @returns {string}
 */
export function customersIndexPage() {
  return simpleIndex({
    eyebrow: 'Customers / Index',
    title: 'Operators, not spectators.',
    summary: 'Teams that moved a real workload onto the orbital mesh and kept a ground fallback.',
    meta: [
      { label: 'Case studies', value: String(CUSTOMERS.length) },
      { label: 'Industries', value: '6' },
      { label: 'Routes', value: '24' },
    ],
    items: CUSTOMERS.map((customer) => ({
      slug: customer.slug,
      title: customer.name,
      summary: customer.summary,
      badge: customer.industry,
    })),
    kind: 'customers',
    metaLine: (item) => {
      const customer = getCustomer(item.slug);
      return `${customer.metrics[0].value} ${customer.metrics[0].label}`;
    },
  });
}

/**
 * Renders a customer case study.
 * @param {string} slug
 * @returns {string}
 */
export function customerPage(slug) {
  const customer = getCustomer(slug);
  if (!customer) return notFoundPage();
  return `<article class="detail-page">
  ${pageIntro({
    eyebrow: `Customers / ${customer.industry}`,
    title: esc(customer.name),
    summary: customer.summary,
    meta: customer.metrics.map((metric) => ({ label: metric.label, value: metric.value })),
    badge: { label: customer.industry, tone: 'info' },
  })}
  <div class="shell detail-grid">
    <div class="detail-main">
      <blockquote class="case-quote"><p>“${esc(customer.quote)}”</p><footer>${esc(
        customer.author,
      )}</footer></blockquote>
      ${contentSections(customer.sections, customer)}
    </div>
    ${relatedLinks(customer.related)}
  </div>
</article>`;
}

/**
 * Renders the legal index.
 * @returns {string}
 */
export function legalIndexPage() {
  return `<article class="catalog-index">
  ${pageIntro({
    eyebrow: 'Legal / Index',
    title: 'The fine print, in one place.',
    summary:
      'Privacy, terms, data processing, the SLA, and the trust documents behind the network.',
    meta: [
      { label: 'Documents', value: String(LEGAL_PAGES.length) },
      { label: 'Updated', value: '2026-10' },
      { label: 'Contact', value: 'legal@aethercompute.space' },
    ],
  })}
  <div class="shell catalog-grid">${LEGAL_PAGES.map(
    (page) =>
      `<a class="catalog-card" href="/legal/${page.slug}"><span class="catalog-card__eyebrow">Document</span><h2>${esc(
        page.title,
      )}</h2><p>${esc(page.summary)}</p><span class="catalog-card__meta">Updated ${
        page.updated
      } <span aria-hidden="true">→</span></span></a>`,
  ).join('')}</div>
</article>`;
}

/**
 * Renders a legal or trust document with an in-page table of contents.
 * @param {string} slug
 * @returns {string}
 */
export function legalPage(slug) {
  const page = getLegalPage(slug);
  if (!page) return notFoundPage();
  return `<article class="detail-page legal-page">
  ${pageIntro({
    eyebrow: `Legal / ${page.title}`,
    title: esc(page.title),
    summary: page.summary,
    meta: [
      { label: 'Updated', value: page.updated },
      { label: 'Status', value: 'Current' },
      { label: 'Contact', value: 'legal@aethercompute.space' },
    ],
  })}
  <div class="shell legal-grid">
    <div class="legal-main">${contentSections(page.sections, page)}${relatedLinks(page.related)}</div>
    <aside class="legal-toc"><p class="mono-label">Contents</p><ul>${page.sections
      .map(
        (section) => `<li><a href="#${esc(slugify(section.title))}">${esc(section.title)}</a></li>`,
      )
      .join('')}</ul><p class="docs-toc__updated">Last updated ${esc(page.updated)}</p></aside>
  </div>
</article>`;
}

/**
 * Renders the regions index.
 * @returns {string}
 */
