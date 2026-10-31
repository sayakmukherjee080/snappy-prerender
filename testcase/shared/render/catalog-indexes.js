import { REGIONS } from '../content/catalog/regions.js';
import { RESOURCES } from '../content/catalog/resources.js';
import { SOLUTIONS } from '../content/catalog/solutions.js';
import { esc, pageIntro } from './base.js';

export function regionsIndexPage() {
  return `<article class="catalog-index">
  ${pageIntro({
    eyebrow: 'Regions / Index',
    title: 'Nine regions, one mesh.',
    summary: 'Where the ground segment is, what metro it serves, and which path the traffic takes.',
    meta: [
      { label: 'Regions', value: String(REGIONS.length) },
      { label: 'Stations', value: '8' },
      { label: 'Continents', value: '4' },
    ],
  })}
  <div class="shell catalog-grid">${REGIONS.map(
    (region) =>
      `<a class="catalog-card" href="/regions/${region.slug}"><span class="catalog-card__eyebrow">Coverage</span><h2>${esc(
        region.title,
      )}</h2><p>${esc(region.summary)}</p><span class="catalog-card__meta">${
        region.meta[1].value
      } <span aria-hidden="true">→</span></span></a>`,
  ).join('')}</div>
</article>`;
}

/**
 * Renders a region coverage page.
 * @param {string} slug
 * @returns {string}
 */

export function resourcesIndexPage() {
  return `<article class="catalog-index">
  ${pageIntro({
    eyebrow: 'Resources / Index',
    title: 'The operating manual.',
    summary:
      'Support, status, brand, residency, and the small tools that make a route review easier.',
    meta: [
      { label: 'Pages', value: String(RESOURCES.length) },
      { label: 'Support', value: '24/7' },
      { label: 'Status', value: 'Public' },
    ],
  })}
  <div class="shell catalog-grid">${RESOURCES.map(
    (resource) =>
      `<a class="catalog-card" href="/resources/${resource.slug}"><span class="catalog-card__eyebrow">Resource</span><h2>${esc(
        resource.title,
      )}</h2><p>${esc(resource.summary)}</p><span class="catalog-card__meta">Open <span aria-hidden="true">→</span></span></a>`,
  ).join('')}</div>
</article>`;
}

/**
 * Renders a resource page and its optional interactive widget.
 * @param {string} slug
 * @returns {string}
 */

export function solutionsIndexPage() {
  return `<article class="catalog-index">
  ${pageIntro({
    eyebrow: 'Solutions / Index',
    title: 'Inference where the work happens.',
    summary:
      'Orbit is useful when the ground route is long, the region is remote, or the data boundary is explicit.',
    meta: [
      { label: 'Industries', value: String(SOLUTIONS.length) },
      { label: 'Models', value: '8' },
      { label: 'Regions', value: '9' },
    ],
  })}
  <div class="shell catalog-grid">${SOLUTIONS.map(
    (solution) =>
      `<a class="catalog-card" href="/solutions/${solution.slug}"><span class="catalog-card__eyebrow">Industry</span><h2>${esc(
        solution.title,
      )}</h2><p>${esc(solution.summary)}</p><span class="catalog-card__meta">${
        solution.meta[0].value
      } <span aria-hidden="true">→</span></span></a>`,
  ).join('')}</div>
</article>`;
}

/**
 * Renders an industry solution page.
 * @param {string} slug
 * @returns {string}
 */
