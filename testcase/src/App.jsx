import { ErrorBoundary } from './components/index.js';
import { HiddenAccessProvider } from './features/hidden/HiddenAccessProvider.jsx';
import { PaletteProvider } from './features/palette/PaletteProvider.jsx';
import { PreferencesProvider } from './features/preferences/PreferencesProvider.jsx';
import { ToastProvider } from './features/toast/ToastProvider.jsx';
import { AppShell } from './layouts/AppShell.jsx';
import { RouterProvider } from './router.jsx';
import { routes } from './routes/index.js';

/**
 * Composes the route store, preferences, demo gate, toasts, palette, and layout shell.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider routes={routes}>
        <PreferencesProvider>
          <HiddenAccessProvider>
            <ToastProvider>
              <PaletteProvider>
                <AppShell />
              </PaletteProvider>
            </ToastProvider>
          </HiddenAccessProvider>
        </PreferencesProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}
