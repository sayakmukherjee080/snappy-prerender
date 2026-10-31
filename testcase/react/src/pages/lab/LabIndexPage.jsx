import { PageIntro } from '../../components/PageIntro.jsx';
import { LABS } from '../../content/catalog/labs.js';
import { setFeatureFlag, useFeatureFlag } from '../../features/preferences/hooks.js';
import { Link } from '../../router.jsx';

/**
 * Renders the unlisted lab index with links to the twenty React/API demos.
 */
export default function LabIndexPage() {
  const showHidden = useFeatureFlag('showHidden');

  return (
    <article className="catalog-index lab-index">
      <PageIntro
        eyebrow="Lab / Index"
        title="Twenty experiments in the unlisted lab."
        summary="React 19.2 APIs, browser primitives, and a few deliberately awkward problems. The gate is a demo, not a security boundary."
        meta={[
          { label: 'Demos', value: String(LABS.length) },
          { label: 'React', value: '19.2.0' },
          { label: 'Visibility', value: 'Unlisted' },
        ]}
        actions={
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={showHidden}
            onClick={() => setFeatureFlag('showHidden', !showHidden)}
          >
            {showHidden ? 'Hide lab from palette' : 'Show lab in palette'}
          </button>
        }
      />

      <div className="shell catalog-grid">
        {LABS.map((lab) => (
          <Link className="catalog-card lab-card" key={lab.slug} to={`/lab/${lab.slug}`}>
            <span className="catalog-card__eyebrow">{lab.category}</span>
            <h2>{lab.title}</h2>
            <p>{lab.summary}</p>
            <div className="lab-card__tags">
              {lab.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
