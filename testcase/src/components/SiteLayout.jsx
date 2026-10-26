import { useId } from 'react';
import { Footer } from './Footer.jsx';
import { Header } from './Header.jsx';

/**
 * Composes the persistent chrome around every routed page.
 * @param {{ children: unknown }} props
 */
export function SiteLayout({ children }) {
  const generatedId = useId();
  const mainId = `main-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <>
      <a className="skip-link" href={`#${mainId}`}>
        Skip to content
      </a>
      <Header />
      <main id={mainId} tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
