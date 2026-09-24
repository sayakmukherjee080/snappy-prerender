/**
 * Inserts comment separators between adjacent text nodes before the DOM is
 * serialised. HTML cannot express two neighbouring text nodes, so serialising a
 * client-rendered DOM merges them, and hydration then finds one node where the
 * client expects two — which React reports as a failed hydration. React's own server
 * rendering emits the same separators, so this makes captured markup equivalent.
 */
export async function separateTextNodes(page) {
  await page.evaluate(() => {
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
  });
}
