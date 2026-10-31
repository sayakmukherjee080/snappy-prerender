import { useSyncExternalStore } from 'react';
import { hiddenStore } from './store.js';

/**
 * Returns whether the unlisted lab is unlocked in this tab.
 * @returns {boolean}
 */
export function useHiddenAccess() {
  return useSyncExternalStore(
    hiddenStore.subscribe,
    hiddenStore.getSnapshot,
    hiddenStore.getSnapshot,
  );
}
