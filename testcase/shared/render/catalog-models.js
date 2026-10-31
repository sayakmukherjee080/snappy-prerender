import { getModel, MODEL_SPECIALS, MODELS } from '../content/catalog/models.js';
import {
  contentSections,
  detailPage,
  esc,
  link,
  pageIntro,
  relatedLinks,
  statusBadge,
} from './base.js';

const FAMILIES = [
  'All',
  'Flagship',
  'Mixture of experts',
  'Efficient',
  'Retrieval',
  'Multimodal',
  'Code',
];

export function modelsIndexPage() {
  const cards = MODELS.map(
    (
      model,
    ) => `<a class="model-card" href="/models/${model.slug}" data-filter-item data-filter-group="${esc(
      model.family,
    )}" data-filter-text="${esc(`${model.name} ${model.family} ${model.summary}`)}">
    <span class="model-card__family">${esc(model.family)}</span>
    <h2>${esc(model.name)}</h2><p>${esc(model.summary)}</p>
    <dl><div><dt>Context</dt><dd>${esc(model.context)}</dd></div><div><dt>Input</dt><dd>${esc(
      model.input,
    )}</dd></div><div><dt>Output</dt><dd>${esc(model.output)}</dd></div></dl>
  </a>`,
  ).join('');

  return `<article class="models-index">
  ${pageIntro({
    eyebrow: 'Models / Catalog',
    title: 'Pick a model, not a mystery.',
    summary:
      'Context, modality, token price, and serving profile for every model on the orbital network.',
    meta: [
      { label: 'Models', value: String(MODELS.length) },
      { label: 'Context', value: 'up to 128k' },
      { label: 'API', value: 'OpenAI-compatible' },
    ],
    actions: `<div class="inline-actions">${link('/models/compare', 'Compare <span aria-hidden="true">→</span>', { className: 'text-link' })}${link('/models/benchmarks', 'Benchmarks <span aria-hidden="true">→</span>', { className: 'text-link' })}</div>`,
  })}
  <div class="shell models-index__body">
    <div class="docs-index__controls">
      <label class="docs-search docs-search--wide"><span class="sr-only">Search models</span><input type="search" placeholder="Search the catalog…" autocomplete="off" data-filter-input data-filter-target=".model-card" /></label>
      <fieldset class="docs-filters" aria-label="Model family" data-filter-group-control>${FAMILIES.map(
        (item, index) =>
          `<button type="button" aria-pressed="${index === 0}" data-filter-group-option="${esc(item)}">${esc(
            item,
          )}</button>`,
      ).join('')}</fieldset>
    </div>
    <p class="docs-index__count" aria-live="polite" data-filter-count>${MODELS.length} models</p>
    <div class="model-grid" data-filter-list>${cards}</div>
    <p class="docs-index__empty" data-filter-empty hidden>No model matches that search. Try “vision”, “embed”, or “efficient”.</p>
  </div>
</article>`;
}

/**
 * Renders a model detail page with pricing, benchmark bars, and serving notes.
 * @param {string} slug
 * @returns {string}
 */
export function modelPage(slug) {
  const model = getModel(slug);
  if (!model) return notFoundPage();
  return `<article class="detail-page">
  ${pageIntro({
    eyebrow: `Models / ${model.family}`,
    title: esc(model.name),
    summary: model.summary,
    meta: [
      { label: 'Context', value: model.context },
      { label: 'Parameters', value: model.params },
      { label: 'Modality', value: model.modality },
    ],
    badge: { label: model.family, tone: 'info' },
  })}
  <div class="shell detail-grid">
    <div class="detail-main">
      <div class="model-pricing">
        <div><span class="mono-label">Input</span><strong>${esc(model.input)}</strong></div>
        <div><span class="mono-label">Output</span><strong>${esc(model.output)}</strong></div>
        <div><span class="mono-label">Serving</span><strong>Orbital node</strong></div>
      </div>
      ${contentSections(model.sections, model)}
      <section class="model-benchmarks">
        <div class="model-benchmarks__head"><h2>Measured benchmarks</h2>${statusBadge('Illustrative')}</div>
        ${model.benchmarks
          .map(
            (benchmark) =>
              `<div class="benchmark"><span class="benchmark__label">${esc(
                benchmark.label,
              )}</span><span class="benchmark__track" aria-hidden="true"><span class="benchmark__bar" style="width:${
                (benchmark.value / benchmark.max) * 100
              }%"></span></span><span class="benchmark__value">${benchmark.value}</span></div>`,
          )
          .join('')}
        <p class="source-note">Scores are measured on the production node image. They are directional, not a substitute for your own evaluation.</p>
      </section>
    </div>
    ${relatedLinks(model.related)}
  </div>
</article>`;
}

/**
 * Renders the compare, benchmarks, or deprecated model page.
 * @param {string} slug
 * @returns {string}
 */
export function modelSpecialPage(slug) {
  const page = MODEL_SPECIALS.find((item) => item.slug === slug);
  if (!page) return notFoundPage();
  return detailPage({ ...page, eyebrow: `Models / ${page.title}` });
}

/**
 * Renders the searchable documentation index.
 * @returns {string}
 */
