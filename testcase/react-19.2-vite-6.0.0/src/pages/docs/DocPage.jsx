import { CodeBlock } from '../../components/CodeBlock.jsx';
import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { getDoc, getDocBySlug } from '../../content/catalog/docs.js';
import { usePreferences } from '../../features/preferences/hooks.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a docs article with sections, optional code, and related links.
 * @param {{ section?: string }} props
 */
export default function DocPage({ section }) {
  const { slug } = useParams();
  const preferences = usePreferences();
  const doc = section ? getDoc(section, slug) : getDocBySlug(slug);

  if (!doc) return <NotFound />;

  return (
    <article className="docs-article">
      <PageIntro
        eyebrow={`Docs / ${doc.section}`}
        title={doc.title}
        summary={doc.summary}
        meta={[
          { label: 'Section', value: doc.section },
          { label: 'Updated', value: doc.updated },
          { label: 'API', value: 'v1' },
        ]}
      />

      <div className="shell docs-article__body">
        <ContentSections sections={doc.sections} record={doc} preferences={preferences} />
        {doc.code && <CodeBlock label={`${doc.slug}.sh`} code={doc.code} />}
        <RelatedLinks links={doc.related} />
      </div>
    </article>
  );
}
