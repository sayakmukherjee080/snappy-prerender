import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPool, mapLimit } from '../../src/core/scheduler.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createPool', () => {
  it('processes tasks pushed before the run starts', async () => {
    const seen = [];
    const pool = createPool({ concurrency: 2, handler: async (item) => seen.push(item) });
    pool.push([1, 2, 3]);
    await pool.run();
    assert.deepEqual(seen.sort(), [1, 2, 3]);
  });

  it('processes tasks discovered while running, which is how crawling works', async () => {
    const seen = [];
    const pool = createPool({
      concurrency: 3,
      handler: async (item) => {
        seen.push(item);
        await delay(5);
        if (item < 3) pool.push([item + 1]);
      },
    });
    pool.push([1]);
    await pool.run();
    assert.deepEqual(seen.sort(), [1, 2, 3]);
  });

  it('never exceeds the configured concurrency', async () => {
    let active = 0;
    let peak = 0;
    const pool = createPool({
      concurrency: 2,
      handler: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await delay(5);
        active -= 1;
      },
    });
    pool.push([1, 2, 3, 4, 5]);
    await pool.run();
    assert.equal(peak, 2);
  });

  it('keeps running after a handler throws and reports the error', async () => {
    const seen = [];
    const pool = createPool({
      concurrency: 2,
      handler: async (item) => {
        if (item === 2) throw new Error('boom');
        seen.push(item);
      },
    });
    pool.push([1, 2, 3]);
    const { errors } = await pool.run();
    assert.deepEqual(seen.sort(), [1, 3]);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].item, 2);
  });

  it('rejects work pushed after the pool finished instead of dropping it silently', async () => {
    const pool = createPool({ concurrency: 1, handler: async () => {} });
    pool.push([1]);
    await pool.run();
    assert.throws(() => pool.push([2]), /after the pool has finished/);
  });
});

describe('mapLimit', () => {
  it('preserves result order and collects per-item errors', async () => {
    const { results, errors } = await mapLimit([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error('nope');
      return item * 10;
    });
    assert.deepEqual(results, [10, undefined, 30]);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].item, 2);
  });
});
