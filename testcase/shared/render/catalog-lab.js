import { LABS } from '../content/catalog/labs.js';
import { breadcrumbs, esc, pageIntro, statusBadge } from './base.js';

export function labLayout({ content, path, crumbs = [] }) {
  return `<div class="lab-frame">
  <aside class="lab-sidebar">
    <div class="lab-sidebar__head"><p class="mono-label">Unlisted lab</p>${statusBadge('Demo', 'warning')}</div>
    <p class="lab-sidebar__note">These routes are not in the public navigation. The gate is a demo, not a security boundary.</p>
    <nav class="lab-nav" aria-label="Lab routes">
      <a href="/lab"${path === '/lab' ? ' aria-current="page"' : ''}>Lab index</a>
      ${LABS.map(
        (lab) =>
          `<a href="/lab/${lab.slug}"${path === `/lab/${lab.slug}` ? ' aria-current="page"' : ''}>${esc(
            lab.title,
          )}</a>`,
      ).join('')}
    </nav>
    <button type="button" class="text-link lab-lock" data-lab-lock>Lock lab <span aria-hidden="true">↺</span></button>
  </aside>
  <div class="lab-content">
    ${breadcrumbs(crumbs)}
    ${content}
  </div>
</div>`;
}

/**
 * Renders a catalog index with search and category filters.
 * @param {{ eyebrow: string, title: string, summary: string, meta: Array<object>, cards: string, controls: string, count: number, noun: string, empty: string, bodyClass?: string }} options
 * @returns {string}
 */

export function labIndexPage() {
  return `<article class="catalog-index lab-index">
  ${pageIntro({
    eyebrow: 'Lab / Index',
    title: 'Twenty experiments in the unlisted lab.',
    summary:
      'Framework-native demos, browser primitives, and a few deliberately awkward problems. The gate is a demo, not a security boundary.',
    meta: [
      { label: 'Demos', value: String(LABS.length) },
      { label: 'Visibility', value: 'Unlisted' },
      { label: 'Build', value: 'Native' },
    ],
    actions: `<button type="button" class="button button--ghost" data-lab-visibility aria-pressed="false">Show lab in palette</button>`,
  })}
  <div class="shell catalog-grid">${LABS.map(
    (lab) =>
      `<a class="catalog-card lab-card" href="/lab/${lab.slug}"><span class="catalog-card__eyebrow">${esc(
        lab.category,
      )}</span><h2>${esc(lab.title)}</h2><p>${esc(lab.summary)}</p><div class="lab-card__tags">${lab.tags
        .map((tag) => `<span>${esc(tag)}</span>`)
        .join('')}</div></a>`,
  ).join('')}</div>
</article>`;
}

/**
 * Renders one lab route with a native demo island.
 * @param {string} slug
 * @returns {string}
 */
export function labPage(slug) {
  const lab = LABS.find((item) => item.slug === slug);
  if (!lab) return notFoundPage();
  return `<article class="lab-page">
  ${pageIntro({
    eyebrow: `Lab / ${lab.category}`,
    title: esc(lab.title),
    summary: lab.summary,
    meta: [
      { label: 'Category', value: lab.category },
      { label: 'Route', value: `/lab/${lab.slug}` },
      { label: 'Visibility', value: 'Unlisted' },
    ],
    badge: { label: 'Demo', tone: 'warning' },
  })}
  <div class="shell lab-page__body">
    <div class="lab-card__tags">${lab.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
    <section class="lab-demo" data-island="lab-demo" data-demo="${esc(lab.slug)}">
      <div class="lab-demo__head"><p class="mono-label">Live demo</p><span class="status-badge status-badge--info">Native</span></div>
      <p class="lab-demo__note">This demo is implemented with the host framework's own primitives. The React lab source is the reference, not a shared runtime.</p>
      <div class="lab-demo__stage" data-demo-stage>
        <div data-demo-mount></div>
        <button type="button" class="button button--orange" data-demo-action>Run demo</button>
        <output data-demo-output>Ready.</output>
      </div>
    </section>
    <div class="content-sections">
      <section class="content-section"><h2>What this route exercises</h2><p>${esc(lab.summary)}</p><ul class="content-list">${lab.tags
        .map((tag) => `<li>${esc(tag)}</li>`)
        .join('')}</ul></section>
    </div>
  </div>
</article>`;
}

/**
 * Renders the fallback route for unknown paths.
 * @returns {string}
 */
