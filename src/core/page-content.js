/**
 * Reports whether a rendered page carries any app content. A missing container and an
 * empty container both mean the browser did not receive an app, which is what a 404,
 * a failed bundle, or an empty build looks like after serialisation.
 */
export async function isPageEmpty(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#root, #app, #__next') ?? document.body;
    if (!container) return true;
    const text = (container.textContent ?? '').trim();
    return container.childElementCount === 0 && text.length === 0;
  });
}
