import { useDeferredValue, useId, useMemo, useState, useTransition } from 'react';
import { PageIntro } from '../../components/PageIntro.jsx';
import { BLOG_POSTS, MISSION_LOG } from '../../content/catalog/blog.js';
import { Link, useQueryParam } from '../../router.jsx';

/**
 * Renders the blog or mission-log index with a deferred search and a transition-based filter.
 * @param {{ kind?: 'blog' | 'mission' }} props
 */
export default function BlogIndexPage({ kind = 'blog' }) {
  const isMission = kind === 'mission';
  const items = isMission ? MISSION_LOG : BLOG_POSTS;
  const basePath = isMission ? '/mission-log' : '/blog';
  const categories = ['All', ...new Set(items.map((item) => item.category))];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useQueryParam('category', 'All');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      const matchesQuery =
        !needle || `${item.title} ${item.excerpt} ${item.category}`.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, deferredQuery, items]);

  return (
    <article className="catalog-index">
      <PageIntro
        eyebrow={isMission ? 'Mission log / Index' : 'Blog / Index'}
        title={isMission ? 'Notes from the constellation.' : 'Field notes from orbit.'}
        summary={
          isMission
            ? 'Short operational notes from the constellation: handoffs, station acceptance, and anomalies.'
            : 'Latency, ground segments, radiation, and the engineering behind the orbital inference network.'
        }
        meta={[
          { label: 'Entries', value: String(items.length) },
          { label: 'Categories', value: String(categories.length - 1) },
          { label: 'Updated', value: '2026-10' },
        ]}
      />

      <div className="shell docs-index__body">
        <div className="docs-index__controls">
          <label className="docs-search docs-search--wide" htmlFor={searchId}>
            <span className="sr-only">Search entries</span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isMission ? 'Search the mission log…' : 'Search field notes…'}
              autoComplete="off"
            />
          </label>

          <fieldset className="docs-filters" aria-label="Category">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => startTransition(() => setCategory(item))}
              >
                {item}
              </button>
            ))}
          </fieldset>
        </div>

        <p className="docs-index__count" aria-live="polite">
          {isPending ? 'Filtering…' : `${filtered.length} entries`}
        </p>

        <div className="post-grid">
          {filtered.map((post) => (
            <Link className="post-card" key={post.slug} to={`${basePath}/${post.slug}`}>
              <div className="post-card__meta">
                <span>{post.date}</span>
                <span>{post.category}</span>
                <span>{post.readTime}</span>
              </div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <span className="catalog-card__meta">
                Read <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="docs-index__empty">
            No entry matches “{deferredQuery}”. Try another category.
          </p>
        )}
      </div>
    </article>
  );
}
