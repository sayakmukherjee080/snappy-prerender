import { useDebugValue, useSyncExternalStore } from 'react';
import { preferencesStore } from './store.js';

/**
 * Returns the complete preference snapshot.
 */
export function usePreferences() {
  return useSyncExternalStore(
    preferencesStore.subscribe,
    preferencesStore.getSnapshot,
    preferencesStore.getSnapshot,
  );
}

/**
 * Returns one feature flag and labels it in React DevTools.
 * @param {string} name
 * @returns {boolean}
 */
export function useFeatureFlag(name) {
  const preferences = usePreferences();
  const value = Boolean(preferences.flags[name]);
  useDebugValue(`flag:${name} = ${value}`);
  return value;
}

/**
 * Returns the active content variant.
 * @returns {'a' | 'b'}
 */
export function useVariant() {
  const preferences = usePreferences();
  useDebugValue(`variant = ${preferences.variant}`);
  return preferences.variant;
}

/**
 * Updates one feature flag.
 * @param {string} name
 * @param {boolean} value
 */
export function setFeatureFlag(name, value) {
  preferencesStore.setFlag(name, value);
}

/**
 * Updates the active content variant.
 * @param {'a' | 'b'} variant
 */
export function setVariant(variant) {
  preferencesStore.setVariant(variant);
}
