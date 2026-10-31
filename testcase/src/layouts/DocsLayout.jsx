import { useDeferredValue, useId, useMemo, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { DOC_SECTION_PATHS, DOC_SECTIONS, DOCS, getDocFromPath } from '../content/catalog/docs.js';
import { slugify } from '../lib/slug.js';
import { Link, useRouter } from '../router.jsx';

/**
 * Renders the docs sidebar, content column, and table of contents.
 * @param {{ children: unknown }} props
 */
export function DocsLayout({ children }) {
  const { path } = useRouter();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();
  const doc = getDocFromPath(path);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return DOCS;
    return DOCS.filter((item) =>
      `${item.title} ${item.summary} ${item.section}`.toLowerCase().includes(needle),
    );
  }, [deferredQuery]);

  const pagerIndex = doc
    ? DOCS.findIndex((item) => item.slug === doc.slug && item.section === doc.section)
    : -1;
  const previous = pagerIndex > 0 ? DOCS[pagerIndex - 1] : null;
  const next = pagerIndex >= 0 && pagerIndex < DOCS.length - 1 ? DOCS[pagerIndex + 1] : null;

  return (
    <div className="docs-frame">
      <aside className="docs-sidebar">
        <div className="docs-sidebar__head">
          <p className="mono-label">Documentation</p>
          <label className="docs-search" htmlFor={searchId}>
            <span className="sr-only">Search documentation</span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter docs…"
              autoComplete="off"
            />
          </label>
        </div>

        <nav className="docs-nav" aria-label="Documentation">
          {DOC_SECTIONS.map((section) => {
            const items = filtered.filter((item) => item.section === section);
            if (items.length === 0) return null;
            return (
              <div className="docs-nav__group" key={section}>
                <p className="docs-nav__label">{section}</p>
                <ul>
                  {items.map((item) => {
                    const to = `/docs/${DOC_SECTION_PATHS[item.section]}/${item.slug}`;
                    return (
                      <li key={to}>
                        <Link to={to} aria-current={path === to ? 'page' : undefined}>
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="docs-content">
        <Breadcrumbs />
        {children}
        {(previous || next) && (
          <nav className="docs-pager" aria-label="Docs pagination">
            {previous ? (
              <Link to={`/docs/${DOC_SECTION_PATHS[previous.section]}/${previous.slug}`}>
                <span className="mono-label">Previous</span>
                <strong>{previous.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={`/docs/${DOC_SECTION_PATHS[next.section]}/${next.slug}`}>
                <span className="mono-label">Next</span>
                <strong>{next.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>

      <aside className="docs-toc">
        {doc && (
          <>
            <p className="mono-label">On this page</p>
            <ul>
              {doc.sections.map((section) => (
                <li key={section.title}>
                  <a href={`#${slugify(section.title)}`}>{section.title}</a>
                </li>
              ))}
            </ul>
            <p className="docs-toc__updated">Updated {doc.updated}</p>
          </>
        )}
      </aside>
    </div>
  );
}
