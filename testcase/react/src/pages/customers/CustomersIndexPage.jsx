import { PageIntro } from '../../components/PageIntro.jsx';
import { CUSTOMERS } from '../../content/catalog/customers.js';
import { Link } from '../../router.jsx';

/**
 * Renders the customer case-study index.
 */
export default function CustomersIndexPage() {
  return (
    <article className="catalog-index">
      <PageIntro
        eyebrow="Customers / Index"
        title="Operators, not spectators."
        summary="Teams that moved a real workload onto the orbital mesh and kept a ground fallback."
        meta={[
          { label: 'Case studies', value: String(CUSTOMERS.length) },
          { label: 'Industries', value: '6' },
          { label: 'Routes', value: '24' },
        ]}
      />

      <div className="shell catalog-grid">
        {CUSTOMERS.map((customer) => (
          <Link className="catalog-card" key={customer.slug} to={`/customers/${customer.slug}`}>
            <span className="catalog-card__eyebrow">{customer.industry}</span>
            <h2>{customer.name}</h2>
            <p>{customer.summary}</p>
            <span className="catalog-card__meta">
              {customer.metrics[0].value} {customer.metrics[0].label}{' '}
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
