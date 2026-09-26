import { lazy, Suspense, useEffect } from 'react';
import { Head } from '../../../../src/head/index.js';

const LazyContent = lazy(() => Promise.resolve({ default: () => <p>Lazy content</p> }));

// Throws once the page has rendered, so a build can exercise the page-error path without
// losing the markup. Enabled per route rather than conditionally called, for hooks rules.
function useDeliberatePageError(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(() => {
      throw new Error('deliberate page error');
    }, 0);
    return () => clearTimeout(timer);
  }, [enabled]);
}

function currentPath() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path === '' ? '/' : path;
}

export default function App() {
  const path = currentPath();
  useDeliberatePageError(path === '/page-error');

  if (path === '/head') {
    return (
      <main>
        <Head title="Nineteen head" description="Nine description" image="/share-19.png" />
        <h1>Nineteen head</h1>
        <a href="/">Home</a>
      </main>
    );
  }

  if (path === '/native-title') {
    return (
      <main>
        <title>Native title</title>
        <h1>Native title</h1>
        <a href="/">Home</a>
      </main>
    );
  }

  if (path === '/page-error') {
    return (
      <main>
        <h1>Page error</h1>
        <a href="/">Home</a>
      </main>
    );
  }

  if (path === '/about') {
    return (
      <main>
        <h1>About page</h1>
        <a href="/">Home</a>
      </main>
    );
  }

  if (path === '/mismatch') {
    return (
      <main>
        <h1>Mismatch {Math.random().toString(36).slice(2)}</h1>
      </main>
    );
  }

  if (path === '/adjacent-text') {
    const count = 3;
    return (
      <main>
        <h1>Adjacent text</h1>
        <p>{count} awardees</p>
      </main>
    );
  }

  if (path === '/inline-style') {
    return (
      <main>
        <h1>Inline style</h1>
        <p style={{ opacity: 1 }}>Styled text</p>
      </main>
    );
  }

  if (path === '/suspense') {
    return (
      <main>
        <h1>Suspense</h1>
        <Suspense fallback={null}>
          <LazyContent />
        </Suspense>
      </main>
    );
  }

  return (
    <main>
      <h1>Home page</h1>
      <a href="/about">About</a>
      <a href="/mismatch">Mismatch</a>
      <a href="/adjacent-text">Adjacent</a>
      <a href="/inline-style">Styled</a>
      <a href="/suspense">Suspense</a>
      <a href="/head">Head</a>
      <a href="/native-title">Native title</a>
      <a href="/page-error">Page error</a>
    </main>
  );
}
