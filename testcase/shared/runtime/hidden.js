export const DEMO_UNLOCK_CODE = 'AETHER';
export const HIDDEN_STORAGE_KEY = 'aether.hidden.v1';

/**
 * Reads the unlock flag a prerender run can seed through browser storage state.
 * @returns {boolean}
 */
function readCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${HIDDEN_STORAGE_KEY}=1`);
}

/**
 * Reads the demo unlock flag from local storage.
 * @returns {boolean}
 */
export function readUnlocked() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(HIDDEN_STORAGE_KEY) === '1') return true;
  } catch {
    // Fall through to the cookie used by prerender contexts.
  }
  return readCookie();
}

/**
 * Persists the demo unlock flag.
 * @param {boolean} value
 */
export function writeUnlocked(value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(HIDDEN_STORAGE_KEY, '1');
    else window.localStorage.removeItem(HIDDEN_STORAGE_KEY);
  } catch {
    // The cookie below still lets the current page render.
  }
  // biome-ignore lint/suspicious/noDocumentCookie: the demo gate mirrors its flag to a cookie for prerender runs.
  document.cookie = `${HIDDEN_STORAGE_KEY}=${value ? '1' : '0'}; path=/; max-age=${
    value ? 31536000 : 0
  }; SameSite=Lax`;
}

/**
 * Applies unlock and lock query parameters.
 * @param {string} search
 * @returns {boolean}
 */
export function syncUnlockedFromSearch(search) {
  const params = new URLSearchParams(search);
  if (params.get('unlock') === DEMO_UNLOCK_CODE) {
    writeUnlocked(true);
    return true;
  }
  if (params.get('lock') === '1') {
    writeUnlocked(false);
    return false;
  }
  return readUnlocked();
}
