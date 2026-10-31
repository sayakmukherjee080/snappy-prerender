import { useEffect } from 'react';
import { useRouter } from '../../router.jsx';
import { preferencesStore } from './store.js';

/**
 * Applies URL flags, listens for cross-tab preference changes, and keeps the store in sync.
 * @param {{ children: unknown }} props
 */
export function PreferencesProvider({ children }) {
  const { location } = useRouter();

  useEffect(() => {
    preferencesStore.syncFromUrl(location.search);
  }, [location.search]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'aether.preferences.v1') preferencesStore.syncFromStorage();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return children;
}
