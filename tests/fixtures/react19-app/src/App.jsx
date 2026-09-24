import { lazy, Suspense } from 'react';

const LazyContent = lazy(() => Promise.resolve({ default: () => <p>Lazy content</p> }));

function currentPath() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path === '' ? '/' : path;
}

export default function App() {
  const path = currentPath();

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
    </main>
  );
}
