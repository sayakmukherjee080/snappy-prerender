import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { BLOG_POSTS, MISSION_LOG } from '../../content/catalog/blog.js';
import { usePreferences } from '../../features/preferences/hooks.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a blog post or mission-log entry.
 * @param {{ kind?: 'blog' | 'mission' }} props
 */
export default function BlogPage({ kind = 'blog' }) {
  const { slug } = useParams();
  const isMission = kind === 'mission';
  const post = (isMission ? MISSION_LOG : BLOG_POSTS).find((item) => item.slug === slug);
  const preferences = usePreferences();

  if (!post) return <NotFound />;

  return (
    <article className="post-page">
      <PageIntro
        eyebrow={isMission ? `Mission log / ${post.date}` : `Blog / ${post.category}`}
        title={post.title}
        summary={post.excerpt}
        meta={[
          { label: 'Date', value: post.date },
          { label: 'Category', value: post.category },
          { label: 'Read', value: post.readTime },
        ]}
        badge={{ label: post.author, tone: 'neutral' }}
      />

      <div className="shell post-page__body">
        <ContentSections sections={post.sections} record={post} preferences={preferences} />
        <RelatedLinks links={post.related} />
      </div>
    </article>
  );
}
