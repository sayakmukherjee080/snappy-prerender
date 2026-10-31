import { Suspense, use, useDeferredValue, useId, useMemo, useState, useTransition } from 'react';
import { Head } from '../../../../src/head/index.js';
import { PageIntro } from '../../components/PageIntro.jsx';
import { API_SOURCE } from '../../content/apiSource.js';
import { ApiSkeleton } from '../../features/api/ApiSkeleton.jsx';
import { NewsBoundary } from '../../features/api/NewsBoundary.jsx';
import { newsResource } from '../../features/api/newsResource.js';
import { Link } from '../../router.jsx';

/**
 * Formats an API date without trusting it to be a valid date.
 * @param {string} value
 * @returns {string}
 */
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Renders the live article index backed by the Spaceflight News API.
 */
export default function ApiIndexPage() {
  return (
    <>
      <Head
        title="API explorer"
        description="Fifty live pages built at runtime from the Spaceflight News API, with no local article fixtures."
        robots="noindex,follow"
      />
      <NewsBoundary>
        <Suspense fallback={<ApiSkeleton />}>
          <ApiIndexContent />
        </Suspense>
      </NewsBoundary>
    </>
  );
}

/**
 * Reads the cached API response and renders the searchable article grid.
 */
function ApiIndexContent() {
  const data = use(newsResource.load());
  const [query, setQuery] = useState('');
  const [site, setSite] = useState('All');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const sites = useMemo(
    () => ['All', ...new Set(data.articles.map((article) => article.newsSite))],
    [data.articles],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return data.articles
      .map((article, index) => ({ article, index }))
      .filter(({ article }) => {
        const matchesSite = site === 'All' || article.newsSite === site;
        const matchesQuery =
          !needle ||
          `${article.title} ${article.summary} ${article.newsSite}`.toLowerCase().includes(needle);
        return matchesSite && matchesQuery;
      });
  }, [data.articles, deferredQuery, site]);

  return (
    <>
      <Head
        title="API explorer"
        description="Fifty live pages built at runtime from the Spaceflight News API, with no local article fixtures."
        robots="index,follow"
      />
      <article className="api-index">
        <PageIntro
          eyebrow="API / Live source"
          title="Fifty pages from a live API."
          summary="Every page in this section reads the Spaceflight News API at runtime. There are no local fixtures: the index and the fifty article routes share one cached response."
          meta={[
            { label: 'Source', value: API_SOURCE.name },
            { label: 'Articles', value: String(data.articles.length) },
            { label: 'Cache', value: 'In-memory · 20s timeout' },
          ]}
          actions={
            <a
              className="text-link"
              href={API_SOURCE.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              API docs <span aria-hidden="true">↗</span>
            </a>
          }
        />

        <div className="shell api-index__body">
          <div className="docs-index__controls">
            <label className="docs-search docs-search--wide" htmlFor={searchId}>
              <span className="sr-only">Search API articles</span>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the live article feed…"
                autoComplete="off"
              />
            </label>

            <fieldset className="docs-filters" aria-label="Publisher">
              {sites.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={site === item}
                  onClick={() => startTransition(() => setSite(item))}
                >
                  {item}
                </button>
              ))}
            </fieldset>
          </div>

          <p className="docs-index__count" aria-live="polite">
            {isPending ? 'Filtering…' : `${filtered.length} articles`}
          </p>

          <div className="api-grid">
            {filtered.map(({ article, index }) => (
              <Link
                className="api-card"
                key={article.id || index}
                to={`/api/articles/${index + 1}`}
              >
                <div className="api-card__meta">
                  <span>{article.newsSite}</span>
                  <span>{formatDate(article.publishedAt)}</span>
                </div>
                <h2>{article.title}</h2>
                <p>
                  {article.summary.slice(0, 180)}
                  {article.summary.length > 180 ? '…' : ''}
                </p>
                <span className="api-card__open">
                  Open live record <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="docs-index__empty">No article matches “{deferredQuery}”.</p>
          )}

          <p className="source-note">
            {API_SOURCE.attribution} Fetched once per session and cached in memory; the API can rate
            limit or fail independently of this site.
          </p>
        </div>
      </article>
    </>
  );
}
