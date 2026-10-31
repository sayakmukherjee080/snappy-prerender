import { useDeferredValue, useId, useMemo, useState, useTransition } from 'react';
import { LabShell } from './LabShell.jsx';

const CATEGORIES = ['All', 'Latency', 'Hardware', 'Network', 'Pricing'];
const ITEMS = Array.from({ length: 5000 }, (_, index) => ({
  id: index,
  title: `Route note ${String(index + 1).padStart(4, '0')}`,
  category: CATEGORIES[(index % (CATEGORIES.length - 1)) + 1],
  body: `A deterministic note about handoffs, radiators, and p50 on corridor ${index % 97}.`,
}));

/**
 * Highlights the matching part of a result title.
 * @param {{ text: string, needle: string }} props
 */
function Highlight({ text, needle }) {
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

/**
 * Demonstrates deferred search, a transition-based filter, and stale-result feedback.
 */
export default function DeferredSearchLab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();
  const isStale = query !== deferredQuery;

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return ITEMS.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      const matchesQuery =
        !needle || `${item.title} ${item.body} ${item.category}`.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    }).slice(0, 60);
  }, [category, deferredQuery]);

  return (
    <LabShell
      title="Deferred search"
      summary="Five thousand items, a deferred query, and a visible stale-result indicator."
      tags={['useDeferredValue', 'useTransition', 'useMemo']}
      notes={[
        'Typing updates the input immediately; the result list lags behind.',
        'The stale indicator appears when the query and deferred query differ.',
        'Category changes run in a transition, so the old list stays visible.',
      ]}
    >
      <div className="lab-demo">
        <label className="docs-search docs-search--wide" htmlFor={searchId}>
          <span className="sr-only">Search notes</span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 5,000 route notes…"
            autoComplete="off"
          />
        </label>

        <fieldset className="docs-filters" aria-label="Category">
          {CATEGORIES.map((item) => (
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

        <p className="lab-facts__line" aria-live="polite">
          {isPending ? 'Filtering…' : `${filtered.length} shown`} {isStale ? '· stale results' : ''}
        </p>

        <div className={`deferred-results${isStale ? ' deferred-results--stale' : ''}`}>
          {filtered.map((item) => (
            <article key={item.id}>
              <span className="mono-label">{item.category}</span>
              <h3>
                <Highlight text={item.title} needle={deferredQuery} />
              </h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </LabShell>
  );
}
