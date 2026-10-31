/**
 * Converts a label into a stable lowercase anchor slug.
 * @param {string} value
 * @returns {string}
 */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
