import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { CommandPalette } from './CommandPalette.jsx';

const PaletteContext = createContext(null);

/**
 * Owns the global command palette open state and its keyboard shortcut.
 * @param {{ children: unknown }} props
 */
export function PaletteProvider({ children }) {
  const [open, setOpen] = useState(false);

  const handleGlobalKeyDown = useEffectEvent((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setOpen((current) => !current);
    }
    if (event.key === 'Escape') setOpen(false);
  });

  useEffect(() => {
    const handler = (event) => handleGlobalKeyDown(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGlobalKeyDown]);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, openPalette, closePalette }),
    [open, openPalette, closePalette],
  );

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onClose={closePalette} />
    </PaletteContext.Provider>
  );
}

/**
 * Returns the command palette controls.
 */
export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) throw new Error('usePalette must be used inside PaletteProvider.');
  return context;
}
