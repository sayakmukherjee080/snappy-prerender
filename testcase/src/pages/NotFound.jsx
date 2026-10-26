import { usePageMeta } from '../hooks/usePageMeta.js';
import { Link } from '../router.jsx';

/**
 * Renders the fallback route for unknown paths.
 */
export default function NotFound() {
  usePageMeta({
    title: 'Page not found',
    description: 'The requested Aether Compute page does not exist.',
  });

  return (
    <section className="not-found">
      <div className="shell not-found__inner">
        <p className="eyebrow">404 / Off course</p>
        <h1>This page lost signal.</h1>
        <p className="lede">
          The route does not exist, or the satellite moved. Either way, the network is still up.
        </p>
        <Link to="/" className="button button--orange">
          Return to orbit <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
