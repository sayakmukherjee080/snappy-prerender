import { CONTACT, FOOTER_GROUPS } from '../content/site.js';
import { Link } from '../router.jsx';
import { Logo } from './Logo.jsx';

/**
 * Closes every page with navigation, contact details, and the oversized Aether wordmark.
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__top">
          <div className="footer__brand">
            <Link to="/" className="footer__logo" aria-label="Aether Compute home">
              <Logo tone="light" />
            </Link>
            <p className="footer__tagline">
              LLM inference from low Earth orbit. Powered by the sun, routed by light, built for
              teams who count milliseconds.
            </p>
            <a className="footer__email" href={`mailto:${CONTACT.general}`}>
              {CONTACT.general}
            </a>
          </div>

          <div className="footer__cols">
            {FOOTER_GROUPS.map((group) => (
              <div className="footer__col" key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer__wordmark" aria-hidden="true">
          AETHER
        </div>

        <div className="footer__bottom">
          <span>© 2026 Aether Compute, Inc.</span>
          <span>254 routes · Denver · Svalbard · Awarua</span>
          <span>Fictional company · illustrative telemetry</span>
        </div>
      </div>
    </footer>
  );
}
