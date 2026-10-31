import { useDeferredValue, useId, useMemo, useState, useTransition } from 'react';
import { PageIntro } from '../../components/PageIntro.jsx';
import { MODELS } from '../../content/catalog/models.js';
import { Link } from '../../router.jsx';

const FAMILIES = [
  'All',
  'Flagship',
  'Mixture of experts',
  'Efficient',
  'Retrieval',
  'Multimodal',
  'Code',
];

/**
 * Renders the searchable model catalog.
 */
export default function ModelsIndexPage() {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('All');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return MODELS.filter((model) => {
      const matchesFamily = family === 'All' || model.family === family;
      const matchesQuery =
        !needle || `${model.name} ${model.family} ${model.summary}`.toLowerCase().includes(needle);
      return matchesFamily && matchesQuery;
    });
  }, [deferredQuery, family]);

  return (
    <article className="models-index">
      <PageIntro
        eyebrow="Models / Catalog"
        title="Pick a model, not a mystery."
        summary="Context, modality, token price, and serving profile for every model on the orbital network."
        meta={[
          { label: 'Models', value: String(MODELS.length) },
          { label: 'Context', value: 'up to 128k' },
          { label: 'API', value: 'OpenAI-compatible' },
        ]}
        actions={
          <div className="inline-actions">
            <Link className="text-link" to="/models/compare">
              Compare <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" to="/models/benchmarks">
              Benchmarks <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />

      <div className="shell models-index__body">
        <div className="docs-index__controls">
          <label className="docs-search docs-search--wide" htmlFor={searchId}>
            <span className="sr-only">Search models</span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the catalog…"
              autoComplete="off"
            />
          </label>

          <fieldset className="docs-filters" aria-label="Model family">
            {FAMILIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={family === item}
                onClick={() => startTransition(() => setFamily(item))}
              >
                {item}
              </button>
            ))}
          </fieldset>
        </div>

        <p className="docs-index__count" aria-live="polite">
          {isPending ? 'Filtering…' : `${filtered.length} models`}
        </p>

        <div className="model-grid">
          {filtered.map((model) => (
            <Link className="model-card" key={model.slug} to={`/models/${model.slug}`}>
              <span className="model-card__family">{model.family}</span>
              <h2>{model.name}</h2>
              <p>{model.summary}</p>
              <dl>
                <div>
                  <dt>Context</dt>
                  <dd>{model.context}</dd>
                </div>
                <div>
                  <dt>Input</dt>
                  <dd>{model.input}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{model.output}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="docs-index__empty">
            No model matches “{deferredQuery}”. Try “vision”, “embed”, or “efficient”.
          </p>
        )}
      </div>
    </article>
  );
}
