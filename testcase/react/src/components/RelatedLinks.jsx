import { Link } from '../router.jsx';

/**
 * Renders the related-links rail for a detail page.
 * @param {{ links?: Array<{ label: string, to: string }> }} props
 */
export function RelatedLinks({ links = [] }) {
  if (links.length === 0) return null;

  return (
    <aside className="detail-aside">
      <p className="mono-label">Related</p>
      <ul className="detail-aside__links">
        {links.map((link) => (
          <li key={`${link.to}-${link.label}`}>
            <Link to={link.to}>
              {link.label} <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
