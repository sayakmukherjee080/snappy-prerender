import { Fragment, h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

/**
 * Hosts the shared site controller and renders its HTML through Preact 10.5.
 */
function App() {
  const [html, setHtml] = useState('');
  const container = useRef(null);

  useEffect(() => {
    const site = createSiteApp({
      async renderHtml(value) {
        setHtml(value);
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      mountIslands,
      getRoot: () => container.current,
    });
    site.start();
  }, []);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: the shared renderer produces the trusted site HTML.
  return <div ref={container} dangerouslySetInnerHTML={{ __html: html }} />;
}

render(<App />, document.getElementById('root'));
