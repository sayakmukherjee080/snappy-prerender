// Containers used by the common setups, so probes can find the app without config.
export const CONTAINER_SELECTOR = '#root, #app, #__next';

/**
 * Reads the empty-page and status-marker state in one browser round trip.
 */
export async function readPageState(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#root, #app, #__next') ?? document.body;
    const text = (container?.textContent ?? '').trim();
    const empty = !container || (container.childElementCount === 0 && text.length === 0);
    const marker = document.querySelector('meta[name="prerender-status-code"]');
    const value = marker ? Number.parseInt(marker.getAttribute('content') ?? '', 10) : null;
    return { empty, statusCode: Number.isFinite(value) ? value : null };
  });
}

/**
 * Decides whether the app kept the prerendered markup. Every captured wrapper on the
 * path from the container to the page body must still be connected; a framework that
 * replaces the wrapper's content but keeps the wrapper itself is a re-render.
 * @param {{ seen: boolean, childConnected: boolean, chainConnected: boolean[] }} boot
 * @returns {boolean | null}
 */
export function isBootMarkupPreserved({ seen, childConnected, chainConnected }) {
  if (!seen) return null;
  if (chainConnected.length > 0) return chainConnected.every(Boolean);
  return Boolean(childConnected);
}

/**
 * Reads the empty-page state, status marker, framework markers and boot state in one
 * round trip. Verification runs this on every route, so the combined probe avoids three
 * separate CDP calls.
 */
export async function readBootState(page, selector = CONTAINER_SELECTOR) {
  const { boot, ...state } = await page.evaluate((containerSelector) => {
    const pageContainer =
      document.querySelector(containerSelector) ?? document.body?.firstElementChild ?? null;
    const contentContainer = document.querySelector(containerSelector) ?? document.body;
    const text = (contentContainer?.textContent ?? '').trim();
    const empty =
      !contentContainer || (contentContainer.childElementCount === 0 && text.length === 0);
    const marker = document.querySelector('meta[name="prerender-status-code"]');
    const value = marker ? Number.parseInt(marker.getAttribute('content') ?? '', 10) : null;
    const markers = pageContainer
      ? {
          react: Object.keys(pageContainer).some(
            (key) => key.startsWith('__reactContainer') || key === '_reactRootContainer',
          ),
          vue: Boolean(
            pageContainer.__vue_app__ ||
              pageContainer.__vueParentComponent ||
              pageContainer._vnode ||
              pageContainer.__vue__,
          ),
          preact: Boolean(
            pageContainer.__k ||
              pageContainer._children ||
              pageContainer.firstElementChild?.__k ||
              pageContainer.firstElementChild?._children,
          ),
          svelte: Boolean(
            pageContainer.__svelte_meta ||
              pageContainer.querySelector?.('[data-svelte-h]') ||
              globalThis.__svelte ||
              [...(pageContainer.childNodes ?? [])].some(
                (node) => node.nodeType === 8 && (node.data === '[' || node.data === '[!'),
              ),
          ),
        }
      : {};
    const child = window.__snappyBoot?.prerenderedChild ?? null;
    const chain = window.__snappyBoot?.prerenderedChain ?? [];
    return {
      empty,
      statusCode: Number.isFinite(value) ? value : null,
      markers,
      boot: {
        seen: Boolean(child),
        childConnected: Boolean(child?.isConnected),
        chainConnected: chain.map((node) => Boolean(node?.isConnected)),
      },
    };
  }, selector);
  return { ...state, markupPreserved: isBootMarkupPreserved(boot) };
}
