<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

const props = defineProps({
  initialHtml: {
    type: String,
    default: '',
  },
});
const html = ref(props.initialHtml);
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
</script>

<template>
  <div ref="container" v-html="html"></div>
</template>
