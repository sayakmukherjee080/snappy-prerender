import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { getLegalPage } from '../../content/catalog/legal.js';
import { usePreferences } from '../../features/preferences/hooks.js';
import { slugify } from '../../lib/slug.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a legal or trust document with an in-page table of contents.
 */
export default function LegalPage() {
  const { slug } = useParams();
  const page = getLegalPage(slug);
  const preferences = usePreferences();

  if (!page) return <NotFound />;

  return (
    <article className="detail-page legal-page">
      <PageIntro
        eyebrow={`Legal / ${page.title}`}
        title={page.title}
        summary={page.summary}
        meta={[
          { label: 'Updated', value: page.updated },
          { label: 'Status', value: 'Current' },
          { label: 'Contact', value: 'legal@aethercompute.space' },
        ]}
      />

      <div className="shell legal-grid">
        <div className="legal-main">
          <ContentSections sections={page.sections} record={page} preferences={preferences} />
          <RelatedLinks links={page.related} />
        </div>
        <aside className="legal-toc">
          <p className="mono-label">Contents</p>
          <ul>
            {page.sections.map((section) => (
              <li key={section.title}>
                <a href={`#${slugify(section.title)}`}>{section.title}</a>
              </li>
            ))}
          </ul>
          <p className="docs-toc__updated">Last updated {page.updated}</p>
        </aside>
      </div>
    </article>
  );
}
