/**
 * Aborts requests to third-party origins so analytics, ads and external widgets
 * cannot mutate the DOM mid-capture or make output non-deterministic. Used by both
 * the render pass and the hydration verification pass so they observe the same page.
 */
export async function blockThirdPartyRequests(page, origin, allowedHosts) {
  const allowed = new Set(allowedHosts.map((host) => host.toLowerCase()));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(data|blob|about|chrome):/.test(url)) return route.continue();
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return route.continue();
    }
    if (parsed.origin === origin) return route.continue();
    if (allowed.has(parsed.hostname.toLowerCase())) return route.continue();
    return route.abort();
  });
}
