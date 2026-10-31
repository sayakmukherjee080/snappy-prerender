import { useDeferredValue, useId, useMemo, useState, useTransition } from 'react';
import { PageIntro } from '../../components/PageIntro.jsx';
import { DOC_SECTION_PATHS, DOC_SECTIONS, DOCS } from '../../content/catalog/docs.js';
import { Link, useQueryParam } from '../../router.jsx';

/**
 * Renders the searchable documentation index.
 */
export default function DocsIndexPage() {
  const [query, setQuery] = useQueryParam('q', '');
  const [section, setSection] = useState('All');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return DOCS.filter((doc) => {
      const matchesSection = section === 'All' || doc.section === section;
      const matchesQuery =
        !needle || `${doc.title} ${doc.summary} ${doc.section}`.toLowerCase().includes(needle);
      return matchesSection && matchesQuery;
    });
  }, [deferredQuery, section]);

  return (
    <article className="docs-index">
      <PageIntro
        eyebrow="Docs / Index"
        title="The orbital inference manual."
        summary="Quickstart, API references, SDKs, and the changelog. Every page is reachable from the command palette too."
        meta={[
          { label: 'Pages', value: '27' },
          { label: 'API', value: 'v1' },
          { label: 'Updated', value: 'Weekly' },
        ]}
      />

      <div className="shell docs-index__body">
        <div className="docs-index__controls">
          <label className="docs-search docs-search--wide" htmlFor={searchId}>
            <span className="sr-only">Search documentation</span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guides, API references, and changelogs…"
              autoComplete="off"
            />
          </label>

          <fieldset className="docs-filters" aria-label="Documentation section">
            {['All', ...DOC_SECTIONS].map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={section === item}
                onClick={() => startTransition(() => setSection(item))}
              >
                {item}
              </button>
            ))}
          </fieldset>
        </div>

        <p className="docs-index__count" aria-live="polite">
          {isPending ? 'Filtering…' : `${filtered.length} pages`}
        </p>

        <div className="docs-grid">
          {filtered.map((doc) => (
            <Link
              className="docs-card"
              key={`${doc.section}-${doc.slug}`}
              to={`/docs/${DOC_SECTION_PATHS[doc.section]}/${doc.slug}`}
            >
              <span className="docs-card__section">{doc.section}</span>
              <h2>{doc.title}</h2>
              <p>{doc.summary}</p>
              <span className="docs-card__meta">
                Updated {doc.updated} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="docs-index__empty">
            No page matches “{deferredQuery}”. Try “handoff”, “streaming”, or “changelog”.
          </p>
        )}
      </div>
    </article>
  );
}
