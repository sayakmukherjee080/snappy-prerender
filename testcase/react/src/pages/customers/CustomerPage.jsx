import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { getCustomer } from '../../content/catalog/customers.js';
import { usePreferences } from '../../features/preferences/hooks.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a customer case study with its quote and outcome metrics.
 */
export default function CustomerPage() {
  const { slug } = useParams();
  const customer = getCustomer(slug);
  const preferences = usePreferences();

  if (!customer) return <NotFound />;

  return (
    <article className="detail-page">
      <PageIntro
        eyebrow={`Customers / ${customer.industry}`}
        title={customer.name}
        summary={customer.summary}
        meta={customer.metrics.map((metric) => ({ label: metric.label, value: metric.value }))}
        badge={{ label: customer.industry, tone: 'info' }}
      />

      <div className="shell detail-grid">
        <div className="detail-main">
          <blockquote className="case-quote">
            <p>“{customer.quote}”</p>
            <footer>{customer.author}</footer>
          </blockquote>

          <ContentSections
            sections={customer.sections}
            record={customer}
            preferences={preferences}
          />
        </div>
        <RelatedLinks links={customer.related} />
      </div>
    </article>
  );
}
