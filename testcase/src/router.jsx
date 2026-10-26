import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const RouterContext = createContext(null);

/**
 * Normalises a browser pathname so `/pricing/` and `/pricing` resolve to the same route.
 * @param {string} pathname
 * @returns {string}
 */
function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Reads the current address into the small location shape the site routes on.
 * @returns {{ path: string, hash: string }}
 */
function readLocation() {
  return {
    path: normalizePath(window.location.pathname),
    hash: window.location.hash,
  };
}

/**
 * Owns the browser history for the five-page site and exposes navigation to every view.
 * @param {{ children: unknown }} props
 */
export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to) => {
    const url = new URL(to, window.location.origin);
    const nextPath = normalizePath(url.pathname);
    const nextAddress = `${url.pathname}${url.search}${url.hash}`;
    const currentAddress = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextAddress === currentAddress) return;

    window.history.pushState({}, '', nextAddress);
    setLocation({ path: nextPath, hash: url.hash });
  }, []);

  return (
    <RouterContext.Provider value={{ ...location, navigate }}>{children}</RouterContext.Provider>
  );
}

/**
 * Returns the active route and the navigation function for links and buttons.
 * @returns {{ path: string, hash: string, navigate: (to: string) => void }}
 */
export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used inside RouterProvider.');
  }
  return context;
}

/**
 * Renders an anchor that navigates in-app for left clicks and preserves normal browser behaviour
 * for new-tab, download, and modifier-key clicks.
 * @param {{ to: string, children: unknown, onClick?: Function, className?: string }} props
 */
export function Link({ to, children, onClick, className, ...rest }) {
  const { navigate } = useRouter();

  function handleClick(event) {
    const isInternal = to.startsWith('/') && !to.startsWith('//');
    if (!isInternal) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    if (rest.download) return;

    onClick?.(event);
    if (event.defaultPrevented) return;

    event.preventDefault();
    navigate(to);
  }

  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
