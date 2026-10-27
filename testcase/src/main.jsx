import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/components.css';
import './styles/content.css';
import './styles/pricing.css';
import './styles/company.css';
import './styles/pages.css';

const container = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Prerendered HTML hydrates; a plain dev build mounts normally.
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
