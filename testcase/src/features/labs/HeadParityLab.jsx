import { useState } from 'react';
import { Head } from '../../../../src/head/index.js';
import { Link } from '../../router.jsx';
import { LabShell } from './LabShell.jsx';

/**
 * Exercises the client-side head parity surface: arbitrary tags, element attributes,
 * multiple social values, default-title behaviour, change callbacks, and React 19 native
 * tag adoption.
 */
export default function HeadParityLab() {
  const [variant, setVariant] = useState(0);
  const [renders, setRenders] = useState(0);
  const [storedLocale] = useState(() => window.localStorage.getItem('locale') ?? 'none');

  const images =
    variant === 0 ? ['/share/aether.png', '/favicon.svg'] : ['/favicon.svg', '/share/aether.png'];
  const [draw, setDraw] = useState('draw to test');

  return (
    <>
      <Head
        title="Head parity lab"
        description="Exercises every client-side head parity feature."
        htmlAttributes={{ className: 'head-parity', 'data-head': 'parity' }}
        bodyAttributes={{ 'data-head-body': 'parity' }}
        images={images}
        alternateLocales={['en_US', 'de_DE']}
        alternates={[
          { hreflang: 'en', href: '/lab/head-parity' },
          { hreflang: 'x-default', href: '/lab/head-parity' },
        ]}
        extra={[
          { rel: 'preload', as: 'style', href: '/favicon.svg' },
          { name: 'application-name', content: 'Aether' },
          { name: 'article:tag', content: 'orbital', duplicates: true },
          { name: 'article:tag', content: 'inference', duplicates: true },
        ]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Head parity lab',
        }}
        tags={[
          { tag: 'base', attrs: { href: '/' } },
          {
            tag: 'script',
            attrs: { type: 'application/json' },
            text: '{"head":"parity","closing":"</script>"}',
          },
          {
            tag: 'style',
            attrs: { media: 'screen' },
            text: '.head-parity-proof{color:rgb(1,2,3)}',
          },
          { tag: 'noscript', html: '<img src="/favicon.svg" alt="">' },
        ]}
        onChangeClientState={(state, added, removed) => {
          window.__headChanges ??= [];
          window.__headChanges.push({
            title: state.title?.text ?? null,
            added: added.map((entry) => entry.key),
            removed: removed.map((entry) => entry.key),
          });
        }}
      />
      {/* React 19 hoists these; the head layer must adopt them instead of duplicating them. */}
      <title>Head parity lab</title>
      <meta name="description" content="Exercises every client-side head parity feature." />
      <meta name="application-name" content="Aether" />
      <link rel="preload" as="style" href="/favicon.svg" />
      <link rel="canonical" href="https://aethercompute.space/lab/head-parity/" />

      <LabShell
        title="Head parity"
        summary="The package head layer owns the document while this page proves every new client-side tag and attribute."
        tags={['Head', 'tags', 'attributes', 'onChangeClientState', 'React 19']}
        notes={[
          'The document title, description, canonical, and social tags come from Head.',
          'The style tag turns the proof line green; the noscript tag holds the pixel markup.',
          'Re-render without changing metadata must not call onChangeClientState.',
          'Changing images must call onChangeClientState with added and removed descriptors.',
          'Leaving the lab must restore the html and body attributes the page started with.',
        ]}
      >
        <div className="lab-demo">
          <dl className="lab-facts">
            <div>
              <dt>Build clock</dt>
              <dd>Fixed by the prerender config</dd>
            </div>
            <div>
              <dt>Seeded random</dt>
              <dd data-testid="random">{draw}</dd>
            </div>
            <div>
              <dt>Seeded locale</dt>
              <dd data-testid="locale">{storedLocale}</dd>
            </div>
            <div>
              <dt>Renders</dt>
              <dd data-testid="renders">{renders}</dd>
            </div>
          </dl>

          <div className="lab-controls">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setRenders((count) => count + 1)}
            >
              Re-render without head change
            </button>
            <button
              type="button"
              className="button button--orange"
              onClick={() => setVariant((value) => (value === 0 ? 1 : 0))}
            >
              Change images
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDraw(Math.random().toFixed(12))}
            >
              Draw seeded random
            </button>
            <Link to="/lab/default-title">Default title lab</Link>
            <Link to="/">Leave lab</Link>
          </div>

          <p className="head-parity-proof">Styled by a generated style tag.</p>
        </div>
      </LabShell>
    </>
  );
}
