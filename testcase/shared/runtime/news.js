import { fetchNewsArticles } from '../lib/newsApi.js';

let cached = null;
let pending = null;

/**
 * Loads the live news feed once and reuses the promise for the whole session.
 * @returns {Promise<{ count: number, articles: Array<object> }>}
 */
export function loadNews() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetchNewsArticles()
      .then((data) => {
        cached = data;
        return data;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Clears the cached feed so the next read performs a fresh request.
 */
export function resetNews() {
  cached = null;
  pending = null;
}
