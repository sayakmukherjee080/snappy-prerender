import { createSignal, onMount } from 'solid-js';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

/**
 * Mounts the framework-agnostic site controller and renders its HTML through Solid.
 */
function App() {
  const [html, setHtml] = createSignal('');
  let container;

  onMount(() => {
    const site = createSiteApp({
      async renderHtml(value) {
        setHtml(value);
        await Promise.resolve();
      },
      mountIslands,
      getRoot: () => container,
    });
    site.start();
  });

  return <div ref={container} innerHTML={html()} />;
}

export default App;
