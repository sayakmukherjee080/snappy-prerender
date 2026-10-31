import { flushSync } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

/**
 * Mounts the framework-agnostic site controller and renders its HTML through Preact.
 * @param {{ initialHtml?: string }} props
 */
function App({ initialHtml = '' }) {
  const [html, setHtml] = useState(initialHtml);
  const container = useRef(null);

  useEffect(() => {
    const site = createSiteApp({
      async renderHtml(value) {
        flushSync(() => setHtml(value));
      },
      mountIslands,
      getRoot: () => container.current,
    });
    site.start();
  }, []);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: the shared renderer produces the trusted site HTML.
  return <div ref={container} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default App;
