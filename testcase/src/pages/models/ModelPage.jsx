import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { getModel } from '../../content/catalog/models.js';
import { usePreferences } from '../../features/preferences/hooks.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a model detail page with pricing, benchmark bars, and serving notes.
 */
export default function ModelPage() {
  const { slug } = useParams();
  const model = getModel(slug);
  const preferences = usePreferences();

  if (!model) return <NotFound />;

  return (
    <article className="detail-page">
      <PageIntro
        eyebrow={`Models / ${model.family}`}
        title={model.name}
        summary={model.summary}
        meta={[
          { label: 'Context', value: model.context },
          { label: 'Parameters', value: model.params },
          { label: 'Modality', value: model.modality },
        ]}
        badge={{ label: model.family, tone: 'info' }}
      />

      <div className="shell detail-grid">
        <div className="detail-main">
          <div className="model-pricing">
            <div>
              <span className="mono-label">Input</span>
              <strong>{model.input}</strong>
            </div>
            <div>
              <span className="mono-label">Output</span>
              <strong>{model.output}</strong>
            </div>
            <div>
              <span className="mono-label">Serving</span>
              <strong>Orbital node</strong>
            </div>
          </div>

          <ContentSections sections={model.sections} record={model} preferences={preferences} />

          <section className="model-benchmarks">
            <div className="model-benchmarks__head">
              <h2>Measured benchmarks</h2>
              <StatusBadge label="Illustrative" tone="neutral" />
            </div>
            {model.benchmarks.map((benchmark) => (
              <div className="benchmark" key={benchmark.label}>
                <span className="benchmark__label">{benchmark.label}</span>
                <span className="benchmark__track" aria-hidden="true">
                  <span
                    className="benchmark__bar"
                    style={{ width: `${(benchmark.value / benchmark.max) * 100}%` }}
                  />
                </span>
                <span className="benchmark__value">{benchmark.value}</span>
              </div>
            ))}
            <p className="source-note">
              Scores are measured on the production node image. They are directional, not a
              substitute for your own evaluation.
            </p>
          </section>
        </div>

        <RelatedLinks links={model.related} />
      </div>
    </article>
  );
}
