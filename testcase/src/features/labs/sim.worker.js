/**
 * Simulates route planning work off the main thread and streams progress back to the page.
 */
self.onmessage = (event) => {
  const { type, count = 120, seed = 7 } = event.data ?? {};
  if (type !== 'run') return;

  let state = seed;
  const results = [];
  for (let index = 0; index < count; index += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const latency = 14 + (state % 31);
    results.push({
      route: `route-${String(index + 1).padStart(3, '0')}`,
      latency,
      handoffs: state % 4,
    });

    if (index % 10 === 0) {
      self.postMessage({ type: 'progress', value: Math.round(((index + 1) / count) * 100) });
    }
  }

  const sorted = results.sort((a, b) => a.latency - b.latency);
  self.postMessage({
    type: 'done',
    results: sorted.slice(0, 8),
    summary: {
      count,
      p50: sorted[Math.floor(sorted.length / 2)].latency,
      best: sorted[0].latency,
    },
  });
};
