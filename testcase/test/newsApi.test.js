import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchNewsArticles,
  normalizeArticle,
  normalizeArticlesResponse,
} from '../src/lib/newsApi.js';

const SAMPLE = {
  id: 42,
  title: 'A live article',
  summary: '  A short summary with   extra whitespace.  ',
  news_site: 'Example Space',
  url: 'https://example.com/article',
  image_url: 'https://example.com/image.jpg',
  published_at: '2026-10-30T04:00:00Z',
};

test('normalizes a valid third-party article', () => {
  const article = normalizeArticle(SAMPLE);
  assert.ok(article);
  assert.equal(article.id, 42);
  assert.equal(article.title, 'A live article');
  assert.equal(article.summary, 'A short summary with extra whitespace.');
  assert.equal(article.newsSite, 'Example Space');
  assert.equal(article.url, 'https://example.com/article');
  assert.equal(article.imageUrl, 'https://example.com/image.jpg');
});

test('rejects articles without a title or a safe HTTP URL', () => {
  assert.equal(normalizeArticle({ ...SAMPLE, title: '' }), null);
  assert.equal(normalizeArticle({ ...SAMPLE, url: 'javascript:alert(1)' }), null);
  assert.equal(normalizeArticle({ ...SAMPLE, url: 'not a url' }), null);
});

test('drops unsafe image URLs while keeping the article', () => {
  const article = normalizeArticle({ ...SAMPLE, image_url: 'javascript:alert(1)' });
  assert.ok(article);
  assert.equal(article.imageUrl, null);
});

test('rejects an unexpected list envelope', () => {
  assert.throws(() => normalizeArticlesResponse({ results: 'nope' }));
  assert.throws(() => normalizeArticlesResponse(null));
});

test('normalizes the list envelope and caps it at the API limit', () => {
  const payload = { count: 1, results: [SAMPLE] };
  const normalized = normalizeArticlesResponse(payload);
  assert.equal(normalized.count, 1);
  assert.equal(normalized.articles.length, 1);
});

test('retries one transient timeout before returning the payload', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    return {
      ok: true,
      json: async () => ({ count: 1, results: [SAMPLE] }),
    };
  };

  try {
    const data = await fetchNewsArticles();
    assert.equal(calls, 2);
    assert.equal(data.articles.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('does not retry a client error from the news source', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 404 };
  };

  try {
    await assert.rejects(() => fetchNewsArticles(), /responded with 404/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
