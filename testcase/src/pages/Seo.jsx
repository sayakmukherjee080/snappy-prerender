import { Head } from '../../../src/head/index.js';
import { Link } from '../router.jsx';

/**
 * Exercises the package's head layer inside the demo site: canonical, Open Graph and
 * social tags are generated from the project metadata injected at prerender time.
 */
export default function Seo() {
  return (
    <section className="shell">
      <Head
        title="SEO fixture"
        description="A route that exercises the head layer and its canonical URL."
        image="/share/aether.png"
        type="article"
        lang="en"
        dir="ltr"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'SEO fixture',
          description: 'A route that exercises structured data and hreflang alternates.',
        }}
        alternates={[
          { hreflang: 'en', href: '/seo' },
          { hreflang: 'x-default', href: '/seo' },
        ]}
      />
      <p className="eyebrow">Test route</p>
      <h1>Head layer fixture</h1>
      <p className="lede">
        This page declares its metadata with the package Head component instead of the site hook.
      </p>
      <Link to="/" className="button button--orange">
        Back to orbit
      </Link>
    </section>
  );
}
