import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Deliberately createRoot rather than hydrateRoot: React discards the prerendered
// markup, which is the pattern the boot-mode detection exists to report.
createRoot(document.getElementById('root')).render(<App />);
