import { Suspense, useEffect, useMemo } from 'react';
import { HiddenGate } from '../features/hidden/HiddenGate.jsx';
import { useHiddenAccess } from '../features/hidden/hooks.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { useRouter } from './context.jsx';
import { getPage, isPageLoaded } from './page-cache.js';
import { RouteErrorBoundary } from './RouteErrorBoundary.jsx';
import { RouteSkeleton } from './RouteSkeleton.jsx';
import { navigationStore } from './store.js';

/**
 * Renders the matched route inside its suspense and error boundaries, and applies route metadata.
 */
export function RouteView() {
  const { route, params, location } = useRouter();
  const hiddenUnlocked = useHiddenAccess();
  const meta = useMemo(() => route.meta?.(params) ?? {}, [route, params]);
  const headOwned = route.headOnly === true && hiddenUnlocked;

  usePageMeta({
    title: meta.title ?? 'Orbital inference network',
    description: meta.description ?? '',
    noindex: route.hidden || route.noindex === true,
    notFound: route.path === '*',
    enabled: !headOwned,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new path must reset scroll even though the callback does not read it.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.path]);

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: finish pending navigation after each committed location.
  useEffect(() => {
    navigationStore.finish();
  }, [location.key]);

  if (route.hidden && !hiddenUnlocked) {
    return <HiddenGate />;
  }

  const Page = getPage(route);
  const content = <Page key={location.path} params={params} {...(route.props ?? {})} />;

  return (
    <RouteErrorBoundary key={location.path}>
      {isPageLoaded(route.path) ? (
        content
      ) : (
        <Suspense fallback={<RouteSkeleton />}>{content}</Suspense>
      )}
    </RouteErrorBoundary>
  );
}
