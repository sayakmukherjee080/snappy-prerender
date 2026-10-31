export const DEMO_UNLOCK_CODE = 'AETHER';
export const HIDDEN_STORAGE_KEY = 'aether.hidden.v1';

const listeners = new Set();
let unlocked = readUnlockCookie();

/**
 * Reads the unlock flag a prerender run can seed through browser storage state. The
 * interactive gate uses local storage; the cookie exists so lab demos can be rendered
 * and verified without a query string or a weaker gate.
 * @returns {boolean}
 */
function readUnlockCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${HIDDEN_STORAGE_KEY}=1`);
}

/**
 * Reads the demo unlock flag from local storage.
 * @returns {boolean}
 */
function readUnlocked() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Emits a hidden-access change.
 */
function emit() {
  for (const listener of listeners) listener();
}

/**
 * External store for the unlisted lab routes. This is a demo gate, not an authentication
 * boundary; it only keeps the lab out of the normal navigation.
 */
export const hiddenStore = {
  /**
   * Registers a hidden-access subscriber.
   * @param {() => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Returns whether the demo lab is unlocked.
   * @returns {boolean}
   */
  getSnapshot() {
    return unlocked;
  },

  /**
   * Re-reads the unlock flag after a cross-tab storage event.
   */
  sync() {
    unlocked = readUnlockCookie() || readUnlocked();
    emit();
  },

  /**
   * Unlocks the lab when the demo code matches.
   * @param {string} code
   * @returns {boolean}
   */
  unlock(code) {
    if (String(code).trim().toUpperCase() !== DEMO_UNLOCK_CODE) return false;
    unlocked = true;
    try {
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, '1');
    } catch {
      // Local storage can be unavailable in private contexts; the in-memory flag still works.
    }
    emit();
    return true;
  },

  /**
   * Locks the lab again.
   */
  lock() {
    unlocked = false;
    try {
      window.localStorage.removeItem(HIDDEN_STORAGE_KEY);
      // biome-ignore lint/suspicious/noDocumentCookie: the demo gate mirrors its flag to a cookie for prerender runs.
      document.cookie = `${HIDDEN_STORAGE_KEY}=; Max-Age=0; path=/`;
    } catch {
      // Ignore storage failures; the in-memory flag is authoritative for this tab.
    }
    emit();
  },
};
