/**
 * Reports whether a host is on the allowlist. Entries may be a hostname, a hostname
 * with a port, a leading-dot or wildcard suffix, or a full URL; matching is
 * case-insensitive.
 */
export function isHostAllowed(hostname, port, allowedHosts) {
  const host = hostname.toLowerCase();
  const withPort = port ? `${host}:${port}` : host;
  for (const raw of allowedHosts) {
    const entry = String(raw).trim().toLowerCase();
    if (entry.length === 0) continue;
    if (entry.includes('://')) {
      try {
        const parsed = new URL(entry);
        if (parsed.hostname.toLowerCase() === host && (!parsed.port || parsed.port === port)) {
          return true;
        }
      } catch {
        // A malformed entry is simply not a match.
      }
      continue;
    }
    if (entry === withPort || entry === host) return true;
    if (entry.startsWith('*.') && host.endsWith(entry.slice(1)) && host !== entry.slice(2)) {
      return true;
    }
    if (entry.startsWith('.') && host.endsWith(entry) && host !== entry.slice(1)) {
      return true;
    }
  }
  return false;
}

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
    if (isHostAllowed(parsed.hostname, parsed.port, allowed)) return allow(route);
    // A route can already be handled or cancelled, and that rejection is not this hook's to
    // report, so it is swallowed rather than surfacing as an unhandled rejection.
    return route.abort().catch(() => {});
  });

  // page.route does not see WebSockets; route them separately when the Playwright
  // version provides the hook.
  if (typeof page.routeWebSocket === 'function') {
    await page.routeWebSocket('**/*', (socket) => {
      let parsed;
      try {
        parsed = new URL(socket.url());
      } catch {
        socket.close();
        return;
      }
      if (parsed.origin === origin || isHostAllowed(parsed.hostname, parsed.port, allowed)) {
        socket.connectToServer();
      } else {
        socket.close();
      }
    });
  }
}

// Continues a request, ignoring the rejection that follows an already-handled route.
function allow(route) {
  return route.continue().catch(() => {});
}
