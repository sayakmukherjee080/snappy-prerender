import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { matchRoute } from './match.js';
import { preloadPage } from './page-cache.js';
import { locationStore, navigationStore, normalizePath } from './store.js';

const RouterContext = createContext(null);

const NOT_FOUND_ROUTE = {
  path: '*',
  group: 'system',
  layout: 'marketing',
  hidden: false,
  noindex: true,
  load: () => import('../pages/NotFound.jsx'),
  meta: () => ({
    title: 'Page not found',
    description: 'The requested Aether Compute page does not exist.',
  }),
  breadcrumbs: () => [],
};

/**
 * Provides the active route, params, query, navigation, and prefetching to the whole app.
 * @param {{ routes: Array<object>, children: unknown }} props
 */
export function RouterProvider({ routes, children }) {
  const location = useSyncExternalStore(
    locationStore.subscribe,
    locationStore.getSnapshot,
    locationStore.getSnapshot,
  );

  const match = useMemo(() => matchRoute(routes, location.path), [routes, location.path]);
  const route = match?.route ?? NOT_FOUND_ROUTE;
  const params = match?.params ?? {};
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const navigate = useCallback((to, options = {}) => {
    navigationStore.start();
    const started = locationStore.navigate(to, options);
    if (!started) navigationStore.finish();
    return started;
  }, []);

  const prefetch = useCallback(
    (to) => {
      if (typeof window === 'undefined') return;
      const url = new URL(to, window.location.origin);
      const matched = matchRoute(routes, normalizePath(url.pathname));
      if (matched?.route?.load) {
        preloadPage(matched.route).catch(() => {});
      }
    },
    [routes],
  );

  const value = useMemo(
    () => ({
      routes,
      route,
      params,
      location,
      query,
      navigate,
      prefetch,
      path: location.path,
      hash: location.hash,
    }),
    [routes, route, params, location, query, navigate, prefetch],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

/**
 * Returns the complete router context.
 */
export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used inside RouterProvider.');
  }
  return context;
}

/**
 * Returns the active route, params, and location.
 */
export function useRoute() {
  const { route, params, location } = useRouter();
  return { route, params, location };
}

/**
 * Returns the dynamic params for the active route.
 */
export function useParams() {
  return useRouter().params;
}

/**
 * Returns the parsed query string for the active route.
 */
export function useQuery() {
  return useRouter().query;
}

/**
 * Reads and writes a single query parameter while preserving the rest of the address.
 * @param {string} name
 * @param {string | null} fallback
 * @returns {[string | null, (value: string | null, options?: object) => void]}
 */
export function useQueryParam(name, fallback = null) {
  const { query, navigate, location } = useRouter();
  const value = query.get(name) ?? fallback;

  const setValue = useCallback(
    (next, options = {}) => {
      const params = new URLSearchParams(location.search);
      if (next === null || next === undefined || next === '') {
        params.delete(name);
      } else {
        params.set(name, String(next));
      }
      const search = params.toString();
      navigate(`${location.path}${search ? `?${search}` : ''}${location.hash}`, {
        replace: true,
        ...options,
      });
    },
    [location, navigate, name],
  );

  return [value, setValue];
}

/**
 * Builds the breadcrumb trail declared by the active route.
 * @returns {Array<{ label: string, to?: string }>}
 */
export function useBreadcrumbs() {
  const { route, params } = useRouter();
  return useMemo(() => route.breadcrumbs?.(params) ?? [], [route, params]);
}

/**
 * Returns the navigation function alone.
 */
export function useNavigate() {
  return useRouter().navigate;
}
