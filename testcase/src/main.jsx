import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { hiddenStore } from './features/hidden/store.js';
import { matchRoute, normalizePath } from './router/index.js';
import { preloadPage } from './router/page-cache.js';
import { routes } from './routes/index.js';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/components.css';
import './styles/content.css';
import './styles/pricing.css';
import './styles/company.css';
import './styles/catalog.css';
import './styles/catalog-widgets.css';
import './styles/docs.css';
import './styles/overlays.css';
import './styles/labs.css';
import './styles/labs-components.css';
import './styles/api.css';
import './styles/pages.css';

const container = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

/**
 * Loads the active route before the first render so a prerendered page adopts the same
 * component tree it was rendered with, then hydrates the existing markup.
 */
async function bootstrap() {
  const matched = matchRoute(routes, normalizePath(window.location.pathname));
  const route = matched?.route ?? {
    path: '*',
    load: () => import('./pages/NotFound.jsx'),
  };
  if (!route.hidden || hiddenStore.getSnapshot()) await preloadPage(route);

  // Prerendered HTML hydrates; a plain dev build mounts normally.
  if (container.hasChildNodes()) hydrateRoot(container, app);
  else createRoot(container).render(app);
}

bootstrap();
