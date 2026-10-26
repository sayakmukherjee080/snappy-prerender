import { SECTION_IDS } from '../content/site.js';
import { Link } from '../router.jsx';

/**
 * Renders the closing conversion band shared by every page.
 * @param {{ title?: string, copy?: string }} props
 */
export function CTASection({
  title = 'Reserve capacity before it leaves the pad.',
  copy = 'Tell us your region, your monthly token volume, and when you need to be live. We will map the route and hold the slot.',
}) {
  return (
    <section className="cta">
      <div className="shell cta__inner">
        <div className="cta__copy">
          <p className="eyebrow">Next launch window · Q1 2027</p>
          <h2>{title}</h2>
        </div>
        <div className="cta__aside">
          <p>{copy}</p>
          <Link to={`/company#${SECTION_IDS.contact}`} className="button button--orange">
            Request capacity <span aria-hidden="true">↗</span>
          </Link>
          <span className="cta__meta">Response within two business days</span>
        </div>
      </div>
    </section>
  );
}
