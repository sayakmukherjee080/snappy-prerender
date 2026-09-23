function currentPath() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path === '' ? '/' : path;
}

export default function App() {
  if (currentPath() === '/about') {
    return (
      <main>
        <h1>About page</h1>
        <a href="/">Home</a>
      </main>
    );
  }

  return (
    <main>
      <h1>Home page</h1>
      <a href="/about">About</a>
    </main>
  );
}
