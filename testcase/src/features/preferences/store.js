export const PREFERENCES_STORAGE_KEY = 'aether.preferences.v1';
const CHANNEL_NAME = 'aether.preferences';

const DEFAULT_STATE = {
  flags: {
    telemetry: true,
    experimental: false,
    compact: false,
    showHidden: false,
    motion: true,
  },
  variant: 'a',
};

const listeners = new Set();
let state = readStoredState();
let channel = null;

/**
 * Reads persisted preferences, falling back to the defaults.
 * @returns {{ flags: Record<string, boolean>, variant: string }}
 */
function readStoredState() {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      flags: { ...DEFAULT_STATE.flags, ...(parsed.flags ?? {}) },
      variant: parsed.variant === 'b' ? 'b' : 'a',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Creates the cross-tab channel on first use.
 */
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * Emits a preference change to every subscriber.
 */
function emit() {
  for (const listener of listeners) listener();
}

/**
 * Persists preferences and broadcasts them to other tabs.
 */
function persist() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private contexts; in-memory state still works.
    }
  }
  getChannel()?.postMessage(state);
}

/**
 * Applies a complete preference state.
 * @param {{ flags: Record<string, boolean>, variant: string }} next
 * @param {boolean} shouldPersist
 */
function applyState(next, shouldPersist = true) {
  state = {
    flags: { ...DEFAULT_STATE.flags, ...(next.flags ?? {}) },
    variant: next.variant === 'b' ? 'b' : 'a',
  };
  if (shouldPersist) persist();
  emit();
}

/**
 * Parses flags from a comma-separated URL value. Prefixing a flag with `-` disables it.
 * @param {string} value
 * @returns {Record<string, boolean>}
 */
function parseFlags(value) {
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
 * External preference store used for feature flags, variants, and cross-tab sync.
 */
export const preferencesStore = {
  /**
   * Registers a preference subscriber.
   * @param {() => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Returns the current immutable preference snapshot.
   */
  getSnapshot() {
    return state;
  },

  /**
   * Sets one feature flag and persists the change.
   * @param {string} name
   * @param {boolean} value
   */
  setFlag(name, value) {
    applyState({ ...state, flags: { ...state.flags, [name]: Boolean(value) } });
  },

  /**
   * Sets the active content variant.
   * @param {'a' | 'b'} variant
   */
  setVariant(variant) {
    applyState({ ...state, variant });
  },

  /**
   * Applies flags and variant from the current query string.
   * @param {string} search
   */
  syncFromUrl(search) {
    const params = new URLSearchParams(search);
    const flagsValue = params.get('flags');
    const variantValue = params.get('variant');
    if (!flagsValue && !variantValue) return;

    applyState({
      flags: { ...state.flags, ...(flagsValue ? parseFlags(flagsValue) : {}) },
      variant: variantValue ? (variantValue === 'b' ? 'b' : 'a') : state.variant,
    });
  },

  /**
   * Re-reads preferences after a storage event from another tab.
   */
  syncFromStorage() {
    state = readStoredState();
    emit();
  },

  /**
   * Restores the default flags and variant.
   */
  reset() {
    applyState(DEFAULT_STATE);
  },
};

if (typeof window !== 'undefined') {
  getChannel()?.addEventListener('message', (event) => {
    if (event.data && typeof event.data === 'object') applyState(event.data, false);
  });
}
