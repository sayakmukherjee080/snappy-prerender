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

  return (
    <main>
      <h1>Home page</h1>
      <a href="/about">About</a>
      <a href="/mismatch">Mismatch</a>
    </main>
  );
}
