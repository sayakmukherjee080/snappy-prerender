/**
 * Resolves the fixed build time used by both the render and verification passes. Explicit
 * values win, then SOURCE_DATE_EPOCH, then the supplied fallback (the run start time).
 * @param {object} config
 * @param {number} fallbackTime
 * @returns {number | null}
 */
export function resolveFixedTime(config, fallbackTime = Date.now()) {
  if (config.freezeTime === false) return null;
  if (typeof config.freezeTime === 'number') return config.freezeTime;
  if (typeof config.freezeTime === 'string') {
    const parsed = Date.parse(config.freezeTime);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const rawSourceDate = process.env.SOURCE_DATE_EPOCH;
  if (rawSourceDate && /^\d+$/.test(rawSourceDate)) {
    return Number.parseInt(rawSourceDate, 10) * 1000;
  }
  return fallbackTime;
}

/**
 * Fixes Date in one page while leaving real timers running, so settling and scheduled
 * work keep the same timing they have in a normal browser.
 * @param {import('playwright-core').Page} page
 * @param {number | null} fixedTime
 */
export async function installClock(page, fixedTime) {
  if (fixedTime === null) return;
  await page.clock.setFixedTime(fixedTime);
}

/**
 * Adds the build-time globals and an optional deterministic Math.random. The PRNG is for
 * reproducible demo content, never for security-sensitive values.
 * @param {import('playwright-core').Page} page
 * @param {{ fixedTime: number | null, randomSeed: number | null }} options
 */
export async function installClockScripts(page, { fixedTime, randomSeed }) {
  if (fixedTime === null && randomSeed === null) return;
  await page.addInitScript(
    ({ time, seed }) => {
      if (time !== null) {
        window.__SNAPPY_NOW__ = time;
        window.__SNAPPY_NOW_ISO__ = new Date(time).toISOString();
      }
      if (seed !== null) {
        let state = seed >>> 0;
        Math.random = () => {
          state = (state + 0x6d2b79f5) >>> 0;
          let value = state;
          value = Math.imul(value ^ (value >>> 15), value | 1);
          value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
          return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
      }
    },
    { time: fixedTime, seed: randomSeed },
  );
}
