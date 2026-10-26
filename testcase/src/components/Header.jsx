import { useEffect, useId, useState } from 'react';
import { NAV_LINKS, SECTION_IDS } from '../content/site.js';
import { Link, useRouter } from '../router.jsx';
import { Logo } from './Logo.jsx';

/**
 * Displays the fixed network-status strip above the main navigation.
 */
function StatusBar() {
  return (
    <div className="statusbar">
      <div className="shell statusbar__inner">
        <span className="statusbar__item statusbar__item--status">
          <span className="status-dot" aria-hidden="true" />
          Network status: nominal
        </span>
        <span className="statusbar__item statusbar__item--optional">
          AETHER-02 · handoff complete · 04:12 UTC
        </span>
        <span className="statusbar__item statusbar__item--optional">Ground relays 8/8</span>
      </div>
    </div>
  );
}

/**
 * Provides the site-wide navigation, the mobile menu, and the status strip.
 */
export function Header() {
  const { path, hash } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const generatedId = useId();
  const mobileNavId = `mobile-nav-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the menu must close whenever the route or anchor changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [path, hash]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <>
      <StatusBar />
      <header className="site-header">
        <div className="shell site-header__inner">
          <Link to="/" className="brand" aria-label="Aether Compute home">
            <Logo />
          </Link>

          <nav className="nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="nav__link"
                aria-current={path === link.to ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="site-header__actions">
            <Link to={`/company#${SECTION_IDS.contact}`} className="button button--sm header-cta">
              Request capacity <span aria-hidden="true">↗</span>
            </Link>
            <button
              type="button"
              className="menu-toggle"
              aria-expanded={menuOpen}
              aria-controls={mobileNavId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="menu-toggle__bar" aria-hidden="true" />
              <span className="menu-toggle__bar" aria-hidden="true" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id={mobileNavId} className="mobile-menu" aria-label="Mobile">
            <div className="mobile-menu__list">
              {NAV_LINKS.map((link, index) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="mobile-menu__link"
                  aria-current={path === link.to ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="mobile-menu__index">{String(index + 1).padStart(2, '0')}</span>
                  <span>{link.label}</span>
                  <span className="mobile-menu__arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
            <Link
              to={`/company#${SECTION_IDS.contact}`}
              className="button button--orange mobile-menu__cta"
              onClick={() => setMenuOpen(false)}
            >
              Request capacity <span aria-hidden="true">↗</span>
            </Link>
            <p className="mobile-menu__meta">
              Orbital inference network · 550 km SSO
              <br />
              Denver · Svalbard · Awarua
            </p>
          </nav>
        )}
      </header>
    </>
  );
}
