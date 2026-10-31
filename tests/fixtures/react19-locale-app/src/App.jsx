import { useEffect, useState } from 'react';

/**
 * Reads the locale the fixture app expects from local storage, falling back to the
 * browser language.
 * @returns {string}
 */
function readLocale() {
  try {
    const stored = window.localStorage.getItem('locale');
    if (stored) return stored;
  } catch {
    // Private contexts may block local storage; the fallback keeps the fixture renderable.
  }
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('locale='));
  if (cookie) return decodeURIComponent(cookie.slice('locale='.length));
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/**
 * Renders a locale-dependent heading and clock text so hydration verification can prove
 * the seeded locale and fixed time reach both passes.
 */
export default function App() {
  const [locale] = useState(readLocale);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const french = locale === 'fr';
  return (
    <main>
      <h1>{french ? 'Accueil' : 'Home'}</h1>
      <p data-testid="copyright">© {now.getFullYear()}</p>
      <p data-testid="timestamp">{now.toISOString()}</p>
      <p data-testid="random">{Math.random()}</p>
      <p data-testid="locale">{locale}</p>
      <a href="/about">{french ? 'À propos' : 'About'}</a>
    </main>
  );
}
