import { matchesPattern } from './routes.js';

/**
 * Resolves one route's effective config by applying matching routeOverrides in order.
 * Later entries win per key; the base config is never mutated.
 */
export function resolveRouteConfig(config, route) {
  let resolved = config;
  for (const override of config.routeOverrides ?? []) {
    if (!matchesPattern(route, override.match)) continue;
    const values = Object.fromEntries(
      Object.entries(override).filter(([key, value]) => key !== 'match' && value !== undefined),
    );
    resolved = { ...resolved, ...values };
  }
  return resolved;
}
