export function setupApi(root, ctx) {
  for (const button of root.querySelectorAll('[data-api-retry]')) {
    button.addEventListener('click', () => ctx.retryNews());
  }
  for (const image of root.querySelectorAll('[data-api-image]')) {
    image.addEventListener('error', () => image.remove());
  }
}

/**
 * Mounts every interactive island in a rendered document.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
