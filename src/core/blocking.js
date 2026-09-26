/**
 * Aborts requests to third-party origins so analytics, ads and external widgets
 * cannot mutate the DOM mid-capture or make output non-deterministic. Used by both
 * the render pass and the hydration verification pass so they observe the same page.
 */
export async function blockThirdPartyRequests(page, origin, allowedHosts) {
  const allowed = new Set(allowedHosts.map((host) => host.toLowerCase()));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(data|blob|about|chrome):/.test(url)) return allow(route);
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return allow(route);
    }
    if (parsed.origin === origin) return allow(route);
    if (allowed.has(parsed.hostname.toLowerCase())) return allow(route);
    // A route can already be handled or cancelled, and that rejection is not this hook's to
    // report, so it is swallowed rather than surfacing as an unhandled rejection.
    return route.abort().catch(() => {});
  });
}

// Continues a request, ignoring the rejection that follows an already-handled route.
function allow(route) {
  return route.continue().catch(() => {});
}
