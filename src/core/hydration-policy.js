import { matchesPattern } from './routes.js';

/**
 * Resolves the hydration policy for one route. Global lists provide the default and a
 * matching route override wins, so a broad allow-list can be narrowed for one route.
 * @param {object} config
 * @param {string} route
 * @returns {'strict' | 'allow-rerender' | 'skip'}
 */
export function resolveHydrationPolicy(config, route) {
  let policy = 'strict';
  if ((config.hydration?.skip ?? []).some((pattern) => matchesPattern(route, pattern))) {
    policy = 'skip';
  } else if (
    (config.hydration?.allowRerender ?? []).some((pattern) => matchesPattern(route, pattern))
  ) {
    policy = 'allow-rerender';
  }
  for (const override of config.routeOverrides ?? []) {
    if (!matchesPattern(route, override.match)) continue;
    if (override.hydration !== undefined) policy = override.hydration;
  }
  return policy;
}

/**
 * Reports whether a verification result is allowed to differ from the prerendered markup.
 * A route only becomes allowed after it actually re-rendered or logged a hydration error.
 * @param {'strict' | 'allow-rerender' | 'skip'} policy
 * @param {{ mode: string, hydrationErrors: string[] }} result
 * @returns {boolean}
 */
export function isHydrationAllowed(policy, result) {
  return (
    policy === 'allow-rerender' &&
    (result.mode === 're-rendered' || (result.hydrationErrors?.length ?? 0) > 0)
  );
}
