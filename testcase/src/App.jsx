import { useEffect } from 'react';
import { ErrorBoundary, SiteLayout } from './components/index.js';
import Company from './pages/Company.jsx';
import Home from './pages/Home.jsx';
import Network from './pages/Network.jsx';
import NotFound from './pages/NotFound.jsx';
import Platform from './pages/Platform.jsx';
import Pricing from './pages/Pricing.jsx';
import Private from './pages/Private.jsx';
import Seo from './pages/Seo.jsx';
import { RouterProvider, useRouter } from './router.jsx';

const ROUTES = {
  '/': Home,
  '/platform': Platform,
  '/network': Network,
  '/pricing': Pricing,
  '/company': Company,
  '/seo': Seo,
  '/private': Private,
};

/**
 * Resolves the active path to a page and restores scroll position after navigation.
 */
function RoutedPage() {
  const { path, hash } = useRouter();
  const Page = ROUTES[path] ?? NotFound;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new path must reset scroll even though the callback does not read it.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [path]);

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="page" key={path}>
      <Page />
    </div>
  );
}

/**
 * Composes routing, layout, and the top-level error boundary.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <SiteLayout>
          <RoutedPage />
        </SiteLayout>
      </RouterProvider>
    </ErrorBoundary>
  );
}
