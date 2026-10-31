import { API_SOURCE } from '../content/apiSource.js';

const MAX_TITLE = 300;
const MAX_SUMMARY = 4000;
const MAX_SITE = 120;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

/**
 * Trims and collapses a third-party text field, returning an empty string for non-strings.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength).replace(/\s+/g, ' ').trim();
}

/**
 * Accepts only absolute HTTP(S) URLs from third-party payloads.
 * @param {unknown} value
 * @param {'http' | 'https'} protocols
 * @returns {string | null}
 */
function safeUrl(value, protocols = 'https') {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (protocols === 'https' && url.protocol !== 'https:') return null;
    if (protocols === 'http' && url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Normalises one untrusted article record into the small shape the pages render.
 * @param {unknown} raw
 * @returns {{ id: number, title: string, summary: string, newsSite: string, url: string, imageUrl: string | null, publishedAt: string } | null}
 */
export function normalizeArticle(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = cleanText(raw.title, MAX_TITLE);
  const summary = cleanText(raw.summary, MAX_SUMMARY);
  const newsSite = cleanText(raw.news_site, MAX_SITE) || 'Unknown publisher';
  const url = safeUrl(raw.url, 'http');
  if (!title || !url) return null;

  return {
    id: Number.isFinite(raw.id) ? raw.id : 0,
    title,
    summary,
    newsSite,
    url,
    imageUrl: safeUrl(raw.image_url, 'https'),
    publishedAt: cleanText(raw.published_at, 40),
  };
}

/**
 * Validates the list envelope and returns the normalised article records.
 * @param {unknown} payload
 * @returns {{ count: number, articles: ReturnType<typeof normalizeArticle>[] }}
 */
export function normalizeArticlesResponse(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.results)) {
    throw new Error('The news source returned an unexpected response.');
  }

  const articles = payload.results.map(normalizeArticle).filter(Boolean).slice(0, API_SOURCE.limit);

  return {
    count: Number.isFinite(payload.count) ? payload.count : articles.length,
    articles,
  };
}

/**
 * Fetches the latest articles with an explicit timeout, retries one transient failure, and
 * validates the response before use.
 * @returns {Promise<{ count: number, articles: ReturnType<typeof normalizeArticle>[] }>}
 */
export async function fetchNewsArticles() {
  let lastError = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchNewsPage();
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_ATTEMPTS || !isRetryableNewsError(error)) break;
      await delay(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

/**
 * Performs one validated request to the news source.
 * @returns {Promise<{ count: number, articles: ReturnType<typeof normalizeArticle>[] }>}
 */
async function fetchNewsPage() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_SOURCE.timeoutMs);
  const url = `${API_SOURCE.baseUrl}${API_SOURCE.articlesPath}?limit=${API_SOURCE.limit}&ordering=-published_at`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const error = new Error(`The news source responded with ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    return normalizeArticlesResponse(await response.json());
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('The news source timed out.');
      timeoutError.name = 'AbortError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reports whether a failed request is worth one retry: a timeout, a network failure, or a
 * rate-limit/server response. A 4xx response is not retried.
 * @param {Error & { status?: number }} error
 * @returns {boolean}
 */
function isRetryableNewsError(error) {
  if (error?.name === 'AbortError') return true;
  if (typeof error?.status === 'number') return error.status === 429 || error.status >= 500;
  return error instanceof TypeError;
}

/**
 * Waits before a retry without blocking the caller's event loop.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
