import { PageIntro } from '../../components/PageIntro.jsx';
import { REGIONS } from '../../content/catalog/regions.js';
import { Link } from '../../router.jsx';

/**
 * Renders the region coverage index.
 */
export default function RegionsIndexPage() {
  return (
    <article className="catalog-index">
      <PageIntro
        eyebrow="Regions / Index"
        title="Nine regions, one mesh."
        summary="Where the ground segment is, what metro it serves, and which path the traffic takes."
        meta={[
          { label: 'Regions', value: String(REGIONS.length) },
          { label: 'Stations', value: '8' },
          { label: 'Continents', value: '4' },
        ]}
      />

      <div className="shell catalog-grid">
        {REGIONS.map((region) => (
          <Link className="catalog-card" key={region.slug} to={`/regions/${region.slug}`}>
            <span className="catalog-card__eyebrow">Coverage</span>
            <h2>{region.title}</h2>
            <p>{region.summary}</p>
            <span className="catalog-card__meta">
              {region.meta[1].value} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
