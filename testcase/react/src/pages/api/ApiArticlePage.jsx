import { Suspense, use, useState } from 'react';
import { Head } from '../../../../../src/head/index.js';
import { PageIntro } from '../../components/PageIntro.jsx';
import { API_SOURCE } from '../../content/apiSource.js';
import { ApiSkeleton } from '../../features/api/ApiSkeleton.jsx';
import { NewsBoundary } from '../../features/api/NewsBoundary.jsx';
import { newsResource } from '../../features/api/newsResource.js';
import { Link, useParams } from '../../router.jsx';

/**
 * Formats an API date without trusting it to be a valid date.
 * @param {string} value
 * @returns {string}
 */
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Renders one live article page with fallback metadata that survives a source failure.
 */
export default function ApiArticlePage() {
  const { index } = useParams();

  return (
    <>
      <Head
        title={`API article ${index}`}
        description={`API article ${index} from the live Spaceflight News API.`}
        robots="noindex,follow"
      />
      <NewsBoundary>
        <Suspense fallback={<ApiSkeleton />}>
          <ApiArticleContent />
        </Suspense>
      </NewsBoundary>
    </>
  );
}

/**
 * Reads the requested article index and renders the record with source links and paging.
 */
function ApiArticleContent() {
  const { index } = useParams();
  const data = use(newsResource.load());
  const articleIndex = Number(index);
  const article = data.articles[articleIndex - 1];

  if (!article) {
    return (
      <>
        <Head
          title={`API article ${index} is missing`}
          description={`The live Spaceflight News API returned ${data.articles.length} records, so article ${index} is not available right now.`}
          robots="noindex,nofollow"
        />
        <section className="api-error">
          <p className="eyebrow">API / Missing record</p>
          <h1>That article is not in the feed.</h1>
          <p className="lede">
            The live source returned {data.articles.length} records, so article {index} is not
            available right now.
          </p>
          <Link to="/api" className="button button--ghost">
            Back to API index
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <Head
        title={article.title}
        description={`API article ${articleIndex}: ${article.summary.slice(0, 160) || article.title}`}
        images={article.imageUrl ? [article.imageUrl] : []}
        robots="index,follow"
      />
      <article className="api-article">
        <PageIntro
          eyebrow={`API / ${article.newsSite}`}
          title={article.title}
          summary={article.summary || 'The source did not include a summary for this record.'}
          meta={[
            { label: 'Published', value: formatDate(article.publishedAt) },
            { label: 'Publisher', value: article.newsSite },
            { label: 'Record', value: `${articleIndex} / ${data.articles.length}` },
          ]}
          badge={{ label: 'Live API record', tone: 'info' }}
        />

        <div className="shell api-article__body">
          <ArticleImage src={article.imageUrl} />

          <div className="api-article__copy">
            <p>{article.summary}</p>
            <a
              className="button button--orange"
              href={article.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Read at {article.newsSite} <span aria-hidden="true">↗</span>
            </a>
          </div>

          <details className="api-raw">
            <summary>Normalized API record</summary>
            <pre className="inline-code">{JSON.stringify(article, null, 2)}</pre>
          </details>

          <nav className="api-pager" aria-label="API article pagination">
            {articleIndex > 1 ? (
              <Link to={`/api/articles/${articleIndex - 1}`}>
                <span className="mono-label">Previous</span>
                <strong>Record {articleIndex - 1}</strong>
              </Link>
            ) : (
              <span />
            )}
            {articleIndex < data.articles.length ? (
              <Link to={`/api/articles/${articleIndex + 1}`}>
                <span className="mono-label">Next</span>
                <strong>Record {articleIndex + 1}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>

          <p className="source-note">{API_SOURCE.attribution}</p>
        </div>
      </article>
    </>
  );
}

/**
 * Renders the article image and hides it if the remote asset fails.
 * @param {{ src: string | null }} props
 */
function ArticleImage({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <img
      className="api-article__image"
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
