<script>
import { onMount, tick } from 'svelte';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

// biome-ignore lint/correctness/noUnusedVariables: used by the Svelte template below.
let html = $state('');
let container;

onMount(() => {
  const site = createSiteApp({
    async renderHtml(value) {
      html = value;
      await tick();
    },
    mountIslands,
    getRoot: () => container,
  });
  site.start();
});
</script>

<div bind:this={container}>{@html html}</div>
