import { createEffect, createSignal } from 'solid-js';
import { render } from 'solid-js/dom';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

/**
 * Hosts the shared site controller and renders its HTML through Solid 0.20.
 */
function App() {
  const [ready, setReady] = createSignal(false);
  let container;

  const attach = (element) => {
    container = element;
  };

  createEffect(() => {
    if (!container || container.dataset.started === 'true') return;
    container.dataset.started = 'true';
    const site = createSiteApp({
      async renderHtml(value) {
        container.innerHTML = value;
        await Promise.resolve();
      },
      mountIslands,
      getRoot: () => container,
    });
    site.start();
    setReady(true);
  });

  return <div ref={attach} data-ready={ready()} />;
}

const root = document.getElementById('root');

// A prerendered document already contains the shared site's markup. Solid 0.20 has no
// hydration entry point, so the captured snapshot is cleared before the app mounts.
root.innerHTML = '';

render(() => <App />, root);
