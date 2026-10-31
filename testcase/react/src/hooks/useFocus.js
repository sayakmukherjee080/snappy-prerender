import { useEffect } from 'react';

/**
 * Locks body scrolling while an overlay is open and restores the previous value on close.
 * @param {boolean} locked
 */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/**
 * Keeps keyboard focus inside a dialog while it is open.
 * @param {{ current: HTMLElement | null }} ref
 * @param {boolean} active
 */
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;

    const node = ref.current;
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () => Array.from(node.querySelectorAll(selector));
    const first = getFocusable()[0];
    first?.focus();

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [ref, active]);
}
