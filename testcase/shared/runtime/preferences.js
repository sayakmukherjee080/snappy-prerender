export const PREFERENCES_STORAGE_KEY = 'aether.preferences.v1';

export const DEFAULT_PREFERENCES = {
  flags: {
    telemetry: true,
    experimental: false,
    compact: false,
    showHidden: false,
    motion: true,
  },
  variant: 'a',
};

/**
 * Reads persisted preferences, falling back to the defaults.
 * @returns {{ flags: Record<string, boolean>, variant: string }}
 */
export function readPreferences() {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      flags: { ...DEFAULT_PREFERENCES.flags, ...(parsed.flags ?? {}) },
      variant: parsed.variant === 'b' ? 'b' : 'a',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Persists the complete preference state.
 * @param {{ flags: Record<string, boolean>, variant: string }} state
 */
export function writePreferences(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private contexts; in-memory state still works.
  }
}

/**
 * Parses flags from a comma-separated URL value. Prefixing a flag with `-` disables it.
 * @param {string} value
 * @returns {Record<string, boolean>}
 */
export function parseFlags(value) {
  const flags = {};
  for (const token of value.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('-')) flags[trimmed.slice(1)] = false;
    else flags[trimmed] = true;
  }
  return flags;
}

/**
 * Applies query-string overrides to a preference snapshot.
 * @param {{ flags: Record<string, boolean>, variant: string }} current
 * @param {string} search
 * @returns {{ flags: Record<string, boolean>, variant: string }}
 */
export function preferencesFromSearch(current, search) {
  const params = new URLSearchParams(search);
  const flagsValue = params.get('flags');
  const variantValue = params.get('variant');
  if (!flagsValue && !variantValue) return current;
  return {
    flags: { ...current.flags, ...(flagsValue ? parseFlags(flagsValue) : {}) },
    variant: variantValue === 'b' ? 'b' : variantValue === 'a' ? 'a' : current.variant,
  };
}
