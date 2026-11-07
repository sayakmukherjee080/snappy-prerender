<template>
  <div ref="container" v-html="html"></div>
</template>

<script>
import { nextTick, onMounted, ref } from 'vue';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

export default {
  name: 'App',
  setup() {
    const html = ref('');
    const container = ref(null);

    onMounted(() => {
      const site = createSiteApp({
        async renderHtml(value) {
          html.value = value;
          await nextTick();
        },
        mountIslands,
        getRoot: () => container.value,
      });
      site.start();
    });

    return { html, container };
  },
};
</script>
