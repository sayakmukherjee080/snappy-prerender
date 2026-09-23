const FREEZE_CSS = [
  '*, *::before, *::after {',
  '  animation-duration: 0.001s !important;',
  '  animation-delay: 0s !important;',
  '  transition-duration: 0.001s !important;',
  '  transition-delay: 0s !important;',
  '  caret-color: transparent !important;',
  '}',
].join('\n');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tracks in-flight network requests so the renderer can wait for the page to go
 * quiet. Listeners must be attached before navigation to count the initial load.
 */
export function trackNetwork(page) {
  let inflight = 0;
  const onStart = () => {
    inflight += 1;
  };
  const onEnd = () => {
    inflight = Math.max(0, inflight - 1);
  };
  page.on('request', onStart);
  page.on('requestfinished', onEnd);
  page.on('requestfailed', onEnd);

  return {
    async waitForQuiet({ quietPeriod, timeout }) {
      const pollInterval = Math.max(10, Math.min(50, Math.floor(quietPeriod / 10)));
      const startedAt = Date.now();
      let quietSince = null;
      while (true) {
        if (inflight === 0) {
          quietSince ??= Date.now();
          if (Date.now() - quietSince >= quietPeriod) return;
        } else {
          quietSince = null;
        }
        if (Date.now() - startedAt > timeout) {
          throw new Error(
            `network did not settle within ${timeout}ms (${inflight} request(s) in flight)`,
          );
        }
        await delay(pollInterval);
      }
    },
    stop() {
      page.off('request', onStart);
      page.off('requestfinished', onEnd);
      page.off('requestfailed', onEnd);
    },
  };
}

/**
 * Waits until the app declares itself ready. Apps opt in by defining the ready flag
 * early and setting it to true when data has loaded; otherwise the network
 * quiescence check below is the only signal.
 */
export async function waitForReady(page, config) {
  await page.waitForLoadState('load', { timeout: config.timeout });

  if (config.waitFor) {
    await page.waitForSelector(config.waitFor, { timeout: config.timeout });
  }

  if (config.readyFlag) {
    const declared = await page.evaluate(
      (flag) => typeof window[flag] !== 'undefined',
      config.readyFlag,
    );
    if (declared) {
      await page.waitForFunction((flag) => window[flag] === true, config.readyFlag, {
        timeout: config.timeout,
        polling: 100,
      });
    }
  }

  if (config.readySelector) {
    await page.waitForSelector(config.readySelector, { timeout: config.timeout });
  }
}

/**
 * Waits for fonts and two animation frames so late layout work lands before the
 * DOM is serialised.
 */
export async function waitForPaint(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/**
 * Full settle sequence for one page: ready contract, quiet network, then paint.
 */
export async function settlePage(page, config, tracker) {
  await waitForReady(page, config);
  await tracker.waitForQuiet(config);
  await waitForPaint(page);
}

/**
 * Neutralises CSS animations and transitions before capture, so route HTML does not
 * freeze mid-animation. The injected style is tagged and stripped during
 * normalisation.
 */
export async function freezeAnimations(page) {
  await page.evaluate((css) => {
    const style = document.createElement('style');
    style.id = 'snappy-freeze';
    style.textContent = css;
    document.head.appendChild(style);
  }, FREEZE_CSS);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Scrolls through the page in viewport steps to trigger IntersectionObserver-based
 * content, then returns to the top.
 */
export async function scrollThroughPage(page, { scrollStepDelay }) {
  await page.evaluate(async (stepDelay) => {
    const step = window.innerHeight;
    const height = document.body.scrollHeight;
    for (let offset = 0; offset < height; offset += step) {
      window.scrollTo(0, offset);
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, stepDelay));
  }, scrollStepDelay);
}
