/**
 * Final page snapshot: inserts comment separators between adjacent text nodes and
 * returns the LCP URL and anchor hrefs in the same browser round trip. HTML cannot
 * express two neighbouring text nodes, so serialising a client-rendered DOM merges
 * them and hydration then finds one node where the client expects two. React's own
 * server rendering emits the same separators.
 */
export async function readRenderSnapshot(page) {
  return page.evaluate(() => {
    // Elements whose children are raw text, where a comment would corrupt the content.
    const RAW_TEXT = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE']);

    // Walks the tree inserting a separator between each pair of adjacent text nodes.
    const separate = (parent) => {
      for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!RAW_TEXT.has(child.tagName)) separate(child);
          continue;
        }
        if (child.nodeType !== Node.TEXT_NODE) continue;
        const next = child.nextSibling;
        if (next?.nodeType === Node.TEXT_NODE) {
          parent.insertBefore(document.createComment(' '), next);
        }
      }
    };

    separate(document.documentElement);
    return {
      lcpUrl: window.__snappyLcp?.at(-1)?.url ?? null,
      hrefs: Array.from(document.querySelectorAll('a[href]'), (anchor) => anchor.href),
    };
  });
}
