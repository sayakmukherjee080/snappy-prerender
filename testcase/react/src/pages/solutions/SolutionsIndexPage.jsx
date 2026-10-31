import { PageIntro } from '../../components/PageIntro.jsx';
import { SOLUTIONS } from '../../content/catalog/solutions.js';
import { Link } from '../../router.jsx';

/**
 * Renders the industry solutions index.
 */
export default function SolutionsIndexPage() {
  return (
    <article className="catalog-index">
      <PageIntro
        eyebrow="Solutions / Index"
        title="Inference where the work happens."
        summary="Orbit is useful when the ground route is long, the region is remote, or the data boundary is explicit."
        meta={[
          { label: 'Industries', value: String(SOLUTIONS.length) },
          { label: 'Models', value: '8' },
          { label: 'Regions', value: '9' },
        ]}
      />

      <div className="shell catalog-grid">
        {SOLUTIONS.map((solution) => (
          <Link className="catalog-card" key={solution.slug} to={`/solutions/${solution.slug}`}>
            <span className="catalog-card__eyebrow">Industry</span>
            <h2>{solution.title}</h2>
            <p>{solution.summary}</p>
            <span className="catalog-card__meta">
              {solution.meta[0].value} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
