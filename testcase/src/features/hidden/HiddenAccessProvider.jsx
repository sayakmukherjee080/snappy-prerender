import { useEffect } from 'react';
import { useRouter } from '../../router.jsx';
import { hiddenStore } from './store.js';

/**
 * Initialises the demo lab gate from URL parameters and keeps tabs in sync.
 * @param {{ children: unknown }} props
 */
export function HiddenAccessProvider({ children }) {
  const { location } = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const unlock = params.get('unlock');
    if (unlock) hiddenStore.unlock(unlock);
    if (params.get('lock') === '1') hiddenStore.lock();
  }, [location.search]);

  useEffect(() => {
    hiddenStore.sync();
    const handleStorage = (event) => {
      if (event.key === 'aether.hidden.v1') hiddenStore.sync();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return children;
}
