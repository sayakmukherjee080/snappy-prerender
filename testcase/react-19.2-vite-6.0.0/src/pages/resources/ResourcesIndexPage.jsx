import { PageIntro } from '../../components/PageIntro.jsx';
import { RESOURCES } from '../../content/catalog/resources.js';
import { Link } from '../../router.jsx';

/**
 * Renders the resource index.
 */
export default function ResourcesIndexPage() {
  return (
    <article className="catalog-index">
      <PageIntro
        eyebrow="Resources / Index"
        title="The operating manual."
        summary="Support, status, brand, residency, and the small tools that make a route review easier."
        meta={[
          { label: 'Pages', value: String(RESOURCES.length) },
          { label: 'Support', value: '24/7' },
          { label: 'Status', value: 'Public' },
        ]}
      />

      <div className="shell catalog-grid">
        {RESOURCES.map((resource) => (
          <Link className="catalog-card" key={resource.slug} to={`/resources/${resource.slug}`}>
            <span className="catalog-card__eyebrow">Resource</span>
            <h2>{resource.title}</h2>
            <p>{resource.summary}</p>
            <span className="catalog-card__meta">
              Open <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
