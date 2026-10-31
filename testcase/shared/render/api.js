import { API_SOURCE } from '../content/apiSource.js';
import { esc, link, pageIntro } from './base.js';

/**
 * Formats an API date without trusting it to be a valid date.
 * @param {string} value
 * @param {'short' | 'long'} style
 * @returns {string}
 */
function formatDate(value, style = 'short') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Renders the loading shell for an API-backed page.
 * @returns {string}
 */
export function apiSkeleton() {
  return `<section class="api-skeleton" aria-busy="true" aria-label="Loading API content">
  <div class="api-skeleton__eyebrow"></div><div class="api-skeleton__title"></div>
  <div class="api-skeleton__grid"><div></div><div></div><div></div></div>
  <div class="api-skeleton__body"></div><div class="api-skeleton__body api-skeleton__body--short"></div>
</section>`;
}

/**
 * Renders the API source failure state.
 * @returns {string}
 */
export function apiError() {
  return `<section class="api-error">
  <p class="eyebrow">API source</p>
  <h1>The source is not responding.</h1>
  <p class="lede">The Spaceflight News API did not return a valid response. Retry the source or return to the API index.</p>
  <div class="lab-controls">
    <button type="button" class="button button--orange" data-api-retry>Retry source</button>
    ${link('/api', 'Back to API index', { className: 'button button--ghost' })}
  </div>
</section>`;
}

/**
 * Renders the live article index.
 * @param {{ articles: Array<object> }} data
 * @returns {string}
 */
export function apiIndexPage(data) {
  const articles = data.articles ?? [];
  const sites = ['All', ...new Set(articles.map((article) => article.newsSite))];

  return `<article class="api-index">
  ${pageIntro({
    eyebrow: 'API / Live source',
    title: 'Fifty pages from a live API.',
    summary:
      'Every page in this section reads the Spaceflight News API at runtime. There are no local fixtures: the index and the fifty article routes share one cached response.',
    meta: [
      { label: 'Source', value: API_SOURCE.name },
      { label: 'Articles', value: String(articles.length) },
      { label: 'Cache', value: 'In-memory · 8s timeout' },
    ],
    actions: `<a class="text-link" href="${esc(
      API_SOURCE.docsUrl,
    )}" target="_blank" rel="noreferrer noopener">API docs <span aria-hidden="true">↗</span></a>`,
  })}
  <div class="shell api-index__body">
    <div class="docs-index__controls">
      <label class="docs-search docs-search--wide"><span class="sr-only">Search API articles</span><input type="search" placeholder="Search the live article feed…" autocomplete="off" data-filter-input data-filter-target=".api-card" /></label>
      <fieldset class="docs-filters" aria-label="Publisher" data-filter-group-control>${sites
        .map(
          (item, index) =>
            `<button type="button" aria-pressed="${index === 0}" data-filter-group-option="${esc(
              item,
            )}">${esc(item)}</button>`,
        )
        .join('')}</fieldset>
    </div>
    <p class="docs-index__count" aria-live="polite" data-filter-count>${articles.length} articles</p>
    <div class="api-grid" data-filter-list>${articles
      .map(
        (article, index) =>
          `<a class="api-card" href="/api/articles/${index + 1}" data-filter-item data-filter-group="${esc(
            article.newsSite,
          )}" data-filter-text="${esc(`${article.title} ${article.summary} ${article.newsSite}`)}">
        <div class="api-card__meta"><span>${esc(article.newsSite)}</span><span>${formatDate(
          article.publishedAt,
        )}</span></div>
        <h2>${esc(article.title)}</h2>
        <p>${esc(article.summary.slice(0, 180))}${article.summary.length > 180 ? '…' : ''}</p>
        <span class="api-card__open">Open live record <span aria-hidden="true">→</span></span>
      </a>`,
      )
      .join('')}</div>
    <p class="docs-index__empty" data-filter-empty hidden>No article matches that search.</p>
    <p class="source-note">${esc(
      API_SOURCE.attribution,
    )} Fetched once per session and cached in memory; the API can rate limit or fail independently of this site.</p>
  </div>
</article>`;
}

/**
 * Renders one live article page.
 * @param {{ articles: Array<object> }} data
 * @param {string | number} index
 * @returns {string}
 */
export function apiArticlePage(data, index) {
  const articles = data.articles ?? [];
  const articleIndex = Number(index);
  const article = articles[articleIndex - 1];

  if (!article) {
    return `<section class="api-error">
      <p class="eyebrow">API / Missing record</p>
      <h1>That article is not in the feed.</h1>
      <p class="lede">The live source returned ${articles.length} records, so article ${esc(
        index,
      )} is not available right now.</p>
      ${link('/api', 'Back to API index', { className: 'button button--ghost' })}
    </section>`;
  }

  return `<article class="api-article">
  ${pageIntro({
    eyebrow: `API / ${article.newsSite}`,
    title: esc(article.title),
    summary: article.summary || 'The source did not include a summary for this record.',
    meta: [
      { label: 'Published', value: formatDate(article.publishedAt, 'long') },
      { label: 'Publisher', value: article.newsSite },
      { label: 'Record', value: `${articleIndex} / ${articles.length}` },
    ],
    badge: { label: 'Live API record', tone: 'info' },
  })}
  <div class="shell api-article__body">
    ${article.imageUrl ? `<img class="api-article__image" src="${esc(article.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-api-image />` : ''}
    <div class="api-article__copy">
      <p>${esc(article.summary)}</p>
      <a class="button button--orange" href="${esc(
        article.url,
      )}" target="_blank" rel="noreferrer noopener">Read at ${esc(
        article.newsSite,
      )} <span aria-hidden="true">↗</span></a>
    </div>
    <details class="api-raw"><summary>Normalized API record</summary><pre class="inline-code">${esc(
      JSON.stringify(article, null, 2),
    )}</pre></details>
    <nav class="api-pager" aria-label="API article pagination">
      ${
        articleIndex > 1
          ? `<a href="/api/articles/${articleIndex - 1}"><span class="mono-label">Previous</span><strong>Record ${
              articleIndex - 1
            }</strong></a>`
          : '<span></span>'
      }
      ${
        articleIndex < articles.length
          ? `<a href="/api/articles/${articleIndex + 1}"><span class="mono-label">Next</span><strong>Record ${
              articleIndex + 1
            }</strong></a>`
          : '<span></span>'
      }
    </nav>
    <p class="source-note">${esc(API_SOURCE.attribution)}</p>
  </div>
</article>`;
}
