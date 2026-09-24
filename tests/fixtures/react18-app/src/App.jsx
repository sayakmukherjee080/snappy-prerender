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

  if (path === '/inline-style') {
    return (
      <main>
        <h1>Inline style</h1>
        <p style={{ opacity: 1 }}>Styled text</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Home page</h1>
      <a href="/about">About</a>
      <a href="/inline-style">Styled</a>
    </main>
  );
}
