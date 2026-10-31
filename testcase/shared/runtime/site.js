import { renderDocument } from '../render/index.js';
import { NOT_FOUND_ROUTE, routes } from '../routes.js';
import { readUnlocked, syncUnlockedFromSearch, writeUnlocked } from './hidden.js';
import { loadNews, resetNews } from './news.js';
import { preferencesFromSearch, readPreferences, writePreferences } from './preferences.js';
import { matchRoute, normalizePath } from './router.js';

// Routes whose prerendered document carries a non-default locale fixture.
const LOCALE_FIXTURES = {
  '/lab/head-parity': { lang: 'fr', ogLocale: 'fr_FR' },
};

/**
 * Reads the metadata defaults the prerenderer persisted, either from the inert JSON script
 * or from the init-script global used during rendering.
 * @returns {object}
 */
function readMetadataDefaults() {
  const element = document.querySelector('script[data-snappy-meta]');
  if (element) {
    try {
      return JSON.parse(element.textContent) ?? {};
    } catch {
      return {};
    }
  }
  return window.__SNAPPY_META__ ?? {};
}

/**
 * Builds the public canonical URL for a route, applying the configured site origin and
 * trailing-slash policy instead of leaking the build server's origin.
 * @param {string} path
 * @param {object} defaults
 * @returns {string}
 */
function publicPageUrl(path, defaults) {
  const siteUrl = defaults.siteUrl ?? window.location.origin;
  const base = defaults.base && defaults.base !== '/' ? defaults.base.replace(/\/$/, '') : '';
  let pathname = path;
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    pathname = pathname.slice(base.length) || '/';
  }
  if (defaults.trailingSlash === 'always') {
    if (pathname !== '/' && !pathname.endsWith('/')) pathname = `${pathname}/`;
  } else if (defaults.trailingSlash === 'never') {
    pathname = pathname.replace(/\/+$/, '') || '/';
  } else if (defaults.flatOutput !== true) {
    // Directory output keeps the trailing slash it is served with; flat output stays
    // extensionless. Using the route instead of location keeps client navigation stable.
    if (pathname !== '/' && !pathname.endsWith('/')) pathname = `${pathname}/`;
  }
  return new URL(`${base}${pathname}`, siteUrl).href;
}

/**
 * Creates the framework-agnostic site controller. The host app supplies the HTML renderer and
 * the island mount hook, so routing, metadata, preferences, the demo gate, and the live feed
 * behave identically in every framework.
 * @param {{ renderHtml: (html: string) => void, mountIslands: (root: HTMLElement, ctx: object) => void, getRoot?: () => HTMLElement | null }} options
 * @returns {{ start: () => void, state: object, navigate: Function, setPreferences: Function, setHidden: Function, dispose: () => void }}
 */
export function createSiteApp({
  renderHtml,
  mountIslands,
  getRoot = () => document.getElementById('root'),
}) {
  const state = {
    path: normalizePath(window.location.pathname),
    search: window.location.search,
    hash: window.location.hash,
    preferences: readPreferences(),
    hiddenUnlocked: readUnlocked(),
    news: { status: 'idle', data: null },
  };
  let renderVersion = 0;
  let disposed = false;

  /**
   * Copies the address bar into the application state.
   */
  function syncLocation() {
    state.path = normalizePath(window.location.pathname);
    state.search = window.location.search;
    state.hash = window.location.hash;
    state.hiddenUnlocked = syncUnlockedFromSearch(state.search);
    state.preferences = preferencesFromSearch(state.preferences, state.search);
  }

  /**
   * Applies the active route metadata to the document head.
   * @param {{ title: string, description: string, noindex: boolean, notFound?: boolean }} meta
   */
  function applyHead(meta) {
    const fullTitle = `${meta.title} — Aether Compute`;
    document.title = fullTitle;
    const defaults = readMetadataDefaults();

    /**
     * Creates or updates one meta tag.
     * @param {string} attribute
     * @param {string} key
     * @param {string} content
     */
    function setMeta(attribute, key, content) {
      let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    }

    setMeta('name', 'description', meta.description);
    setMeta('name', 'robots', meta.noindex ? 'noindex,nofollow' : 'index,follow');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', meta.description);
    setMeta('property', 'og:site_name', 'Aether Compute');
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', meta.description);

    const locale = state.hiddenUnlocked ? LOCALE_FIXTURES[state.path] : null;
    document.documentElement.lang = locale?.lang ?? 'en';
    if (locale) document.documentElement.dataset.snappyLocaleLang = 'true';
    else document.documentElement.removeAttribute('data-snappy-locale-lang');
    for (const tag of document.head.querySelectorAll(
      'meta[property="og:locale"], meta[property="og:locale:alternate"]',
    )) {
      tag.remove();
    }
    for (const link of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) {
      link.remove();
    }
    if (locale) setMeta('property', 'og:locale', locale.ogLocale);

    if (meta.notFound) {
      // A missing page must not advertise a canonical URL for a path that does not exist.
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    } else {
      const canonicalUrl = publicPageUrl(state.path, defaults);
      setMeta('property', 'og:url', canonicalUrl);

      let canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalUrl);
    }
  }

  /**
   * Starts the live news request when an API route needs it.
   * @param {object} route
   * @param {Function} rerender
   */
  function ensureNews(route, rerender) {
    if (!route.page?.startsWith('api')) return;
    if (state.news.status === 'ready' || state.news.status === 'loading') return;
    state.news = { status: 'loading', data: null };
    loadNews()
      .then((data) => {
        state.news = { status: 'ready', data };
        rerender();
      })
      .catch(() => {
        state.news = { status: 'error', data: null };
        rerender();
      });
  }

  /**
   * Renders the current route into the document.
   * @param {{ scroll?: boolean }} options
   * @returns {Promise<void>}
   */
  async function render({ scroll = true } = {}) {
    if (disposed) return;
    renderVersion += 1;
    const version = renderVersion;
    // Lab dialogs are appended to <body>, outside the root that this render replaces.
    // Close and remove them so a navigation cannot leave a modal blocking the new page.
    for (const dialog of document.querySelectorAll('dialog.lab-dialog')) {
      dialog.close();
      dialog.remove();
    }
    // A navigation can happen while the mobile menu has locked body scrolling.
    // Clearing it here keeps the new page scrollable even when the link was outside
    // the menu and therefore never called the menu's close handler.
    document.body.style.removeProperty('overflow');
    const matched = matchRoute(routes, state.path);
    const route = matched?.route ?? NOT_FOUND_ROUTE;
    const params = matched?.params ?? {};

    ensureNews(route, () => render({ scroll: false }));

    const page = renderDocument(route, params, {
      path: state.path,
      search: state.search,
      hash: state.hash,
      preferences: state.preferences,
      hiddenUnlocked: state.hiddenUnlocked,
      news: state.news,
    });

    await renderHtml(page.html);
    // A newer navigation may have started while the host framework was rendering.
    // Only the latest render may update the head and attach island listeners.
    if (disposed || version !== renderVersion) return;
    applyHead(page);

    const root = getRoot();
    if (root) {
      mountIslands(root, {
        state,
        navigate,
        rerender: () => render({ scroll: false }),
        setPreferences,
        setHidden,
        retryNews: () => {
          resetNews();
          state.news = { status: 'loading', data: null };
          render({ scroll: false });
        },
      });
    }

    if (scroll) {
      if (state.hash) {
        const target = document.getElementById(state.hash.slice(1));
        if (target) target.scrollIntoView({ block: 'start' });
        else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    }
  }

  /**
   * Pushes a URL and renders the destination.
   * @param {string} to
   * @param {{ replace?: boolean }} options
   */
  function navigate(to, options = {}) {
    const url = new URL(to, window.location.origin);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return;

    if (options.replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);

    syncLocation();
    render({ scroll: true });
  }

  /**
   * Persists a preference snapshot and re-renders.
   * @param {{ flags: Record<string, boolean>, variant: string }} next
   * @returns {Promise<void>}
   */
  function setPreferences(next) {
    state.preferences = next;
    writePreferences(next);
    return render({ scroll: false });
  }

  /**
   * Persists the demo lab lock state and re-renders.
   * @param {boolean} value
   * @returns {Promise<void>}
   */
  function setHidden(value) {
    state.hiddenUnlocked = value;
    writeUnlocked(value);
    return render({ scroll: false });
  }

  /**
   * Restores state from the address bar after a history navigation.
   */
  function handlePopState() {
    syncLocation();
    render({ scroll: true });
  }

  /**
   * Routes same-origin anchor clicks through the client renderer.
   * @param {MouseEvent} event
   */
  function handleDocumentClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a');
    if (!anchor) return;
    if (anchor.hasAttribute('download')) return;
    if (anchor.target && anchor.target !== '_self') return;
    if ((anchor.getAttribute('rel') ?? '').split(/\s+/).includes('external')) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`);
  }

  window.addEventListener('popstate', handlePopState);
  document.addEventListener('click', handleDocumentClick);

  return {
    start() {
      syncLocation();
      render({ scroll: true });
    },
    /**
     * Removes the document-level listeners so a host framework can unmount this instance
     * without leaving a second router attached to the page.
     */
    dispose() {
      disposed = true;
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick);
    },
    state,
    navigate,
    setPreferences,
    setHidden,
  };
}
