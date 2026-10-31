import { PageIntro } from '../../components/PageIntro.jsx';
import { LEGAL_PAGES } from '../../content/catalog/legal.js';
import { Link } from '../../router.jsx';

/**
 * Renders the legal and trust index.
 */
export default function LegalIndexPage() {
  return (
    <article className="catalog-index">
      <PageIntro
        eyebrow="Legal / Index"
        title="The fine print, in one place."
        summary="Privacy, terms, data processing, the SLA, and the trust documents behind the network."
        meta={[
          { label: 'Documents', value: String(LEGAL_PAGES.length) },
          { label: 'Updated', value: '2026-10' },
          { label: 'Contact', value: 'legal@aethercompute.space' },
        ]}
      />

      <div className="shell catalog-grid">
        {LEGAL_PAGES.map((page) => (
          <Link className="catalog-card" key={page.slug} to={`/legal/${page.slug}`}>
            <span className="catalog-card__eyebrow">Document</span>
            <h2>{page.title}</h2>
            <p>{page.summary}</p>
            <span className="catalog-card__meta">
              Updated {page.updated} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
