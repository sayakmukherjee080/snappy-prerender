import App from './App.svelte';

const target = document.getElementById('root');

// A prerendered document already contains the shared site's markup. Svelte 3 cannot
// hydrate markup it did not render, so the mount replaces that snapshot before the
// controller renders the current route.
target.innerHTML = '';

const app = new App({ target });

export default app;
