/**
 * Dynamic work pool used for route rendering. Tasks may enqueue more tasks while
 * running, which is what lets the crawler discover links from rendered pages.
 * Workers exit only when the queue is empty and nothing is in flight, so `run()`
 * resolves after the last discovered route finishes.
 */
export function createPool({ concurrency, handler }) {
  const queue = [];
  const waiters = [];
  const errors = [];
  let outstanding = 0;
  let finished = false;

  // Resolves every worker parked on an empty queue so they can re-check for work.
  function wakeAll() {
    while (waiters.length > 0) waiters.shift()();
  }

  // Worker loop: drains the queue, parks when empty, exits once nothing is left.
  async function loop() {
    while (true) {
      if (queue.length === 0) {
        if (outstanding === 0) return;
        await new Promise((resolve) => waiters.push(resolve));
        continue;
      }
      const item = queue.shift();
      try {
        await handler(item);
      } catch (error) {
        errors.push({ item, error });
      } finally {
        outstanding -= 1;
        if (outstanding === 0) wakeAll();
      }
    }
  }

  return {
    push(items) {
      if (finished) {
        throw new Error('cannot push work after the pool has finished; push before run() resolves');
      }
      for (const item of items) {
        queue.push(item);
        outstanding += 1;
      }
      wakeAll();
    },
    async run() {
      await Promise.all(Array.from({ length: concurrency }, () => loop()));
      finished = true;
      return { errors };
    },
  };
}

/**
 * Maps a fixed list of items through an async worker with bounded concurrency and
 * per-item error capture, so one failed item never aborts the rest.
 */
export async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length).fill(undefined);
  const errors = [];
  let cursor = 0;

  // Worker loop: claims indices from the shared cursor until the list is consumed.
  async function loop() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        errors.push({ item: items[index], error });
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => loop()));
  return { results, errors };
}
