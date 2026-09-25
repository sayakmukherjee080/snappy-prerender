import { useEffect, useState } from 'react';
import { Head } from '../../../../src/head/index.js';

// Reads the current route from the address bar, matching what the app renders in a browser.
function readPath() {
  return window.location.pathname.replace(/\/$/, '') || '/';
}

// Simulates the client-side navigation a router performs, so head behaviour can be tested
// without pulling a router into the fixture.
function useClientPath() {
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const sync = () => setPath(readPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const navigate = (to) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  return [path, navigate];
}

export default function App() {
  const [path, navigate] = useClientPath();

  let page;
  if (path === '/about') {
    page = (
      <main>
        <h1>About page</h1>
        <a href="/">Home</a>
      </main>
    );
  } else if (path === '/inline-style') {
    page = (
      <main>
        <h1>Inline style</h1>
        <p style={{ opacity: 1 }}>Styled text</p>
      </main>
    );
  } else if (path === '/head-a') {
    page = (
      <main>
        <Head title="Head A" description="Page A description" image="/share-a.png" />
        <h1>Head A</h1>
        <button type="button" onClick={() => navigate('/head-b')}>
          Go to Head B
        </button>
      </main>
    );
  } else if (path === '/head-b') {
    page = (
      <main>
        <Head title="Head B" description="Page B description" image="/share-b.png" type="article" />
        <h1>Head B</h1>
      </main>
    );
  } else {
    page = (
      <main>
        <h1>Home page</h1>
        <a href="/about">About</a>
        <a href="/inline-style">Styled</a>
        <a href="/head-a">Head</a>
      </main>
    );
  }

  return (
    <>
      {/* Layout metadata applies to every route; a page's own Head overrides what it sets. */}
      <Head title="Snappy Fixture" description="Layout default" robots="index,follow" />
      {page}
    </>
  );
}
