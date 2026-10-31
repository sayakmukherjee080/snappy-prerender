import { flushSync } from 'react-dom';

const listeners = new Set();
const navigationListeners = new Set();

let navigationPending = false;

/**
 * Normalises a pathname so `/docs/` and `/docs` resolve to the same route.
 * @param {string} pathname
 * @returns {string}
 */
export function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Reads the browser address into the stable shape used by the location store.
 * @returns {{ path: string, search: string, hash: string, key: string }}
 */
function readLocation() {
  if (typeof window === 'undefined') {
    return { path: '/', search: '', hash: '', key: 'initial' };
  }

  return {
    path: normalizePath(window.location.pathname),
    search: window.location.search,
    hash: window.location.hash,
    key: window.history.state?.key ?? 'initial',
  };
}

/**
 * Creates a unique history key for a navigation entry.
 * @returns {string}
 */
function createKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Returns whether the user has asked the operating system to reduce motion.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

let currentLocation = readLocation();

/**
 * External location store shared by the router and any component that needs the address.
 */
export const locationStore = {
  /**
   * Registers a location subscriber.
   * @param {() => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Returns the current immutable location snapshot.
   * @returns {{ path: string, search: string, hash: string, key: string }}
   */
  getSnapshot() {
    return currentLocation;
  },

  /**
   * Pushes or replaces a URL and commits the new location to React.
   * @param {string} to
   * @param {{ replace?: boolean, viewTransition?: boolean }} options
   * @returns {boolean} Whether a navigation was committed.
   */
  navigate(to, options = {}) {
    if (typeof window === 'undefined') return false;

    const url = new URL(to, window.location.origin);
    const nextAddress = `${url.pathname}${url.search}${url.hash}`;
    const currentAddress = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextAddress === currentAddress) return false;

    const key = createKey();
    const commit = () => {
      if (options.replace) {
        window.history.replaceState({ key }, '', nextAddress);
      } else {
        window.history.pushState({ key }, '', nextAddress);
      }

      currentLocation = {
        path: normalizePath(url.pathname),
        search: url.search,
        hash: url.hash,
        key,
      };
      for (const listener of listeners) listener();
    };

    if (options.viewTransition && document.startViewTransition && !prefersReducedMotion()) {
      document.startViewTransition(() => flushSync(commit));
    } else {
      commit();
    }

    return true;
  },

  /**
   * Moves one entry back in browser history.
   */
  back() {
    if (typeof window !== 'undefined') window.history.back();
  },
};

/**
 * Tracks whether a route navigation is waiting for its lazy page to commit.
 */
export const navigationStore = {
  /**
   * Registers a pending-state subscriber.
   * @param {() => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    navigationListeners.add(listener);
    return () => navigationListeners.delete(listener);
  },

  /**
   * Returns whether navigation is pending.
   * @returns {boolean}
   */
  getSnapshot() {
    return navigationPending;
  },

  /**
   * Marks navigation as pending.
   */
  start() {
    if (navigationPending) return;
    navigationPending = true;
    for (const listener of navigationListeners) listener();
  },

  /**
   * Marks navigation as complete.
   */
  finish() {
    if (!navigationPending) return;
    navigationPending = false;
    for (const listener of navigationListeners) listener();
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentLocation = readLocation();
    for (const listener of listeners) listener();
  });
}
