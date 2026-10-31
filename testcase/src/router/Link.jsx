import { useCallback } from 'react';
import { useRouter } from './context.jsx';

/**
 * Renders an in-app anchor with route prefetching, transition navigation, and browser-native
 * behaviour for new tabs, downloads, and modifier-key clicks.
 * @param {{ to: string, children: unknown, onClick?: Function, className?: string }} props
 */
export function Link({ to, children, onClick, className, ...rest }) {
  const { navigate, prefetch } = useRouter();
  const isInternal = to.startsWith('/') && !to.startsWith('//');
  const { onMouseEnter, onFocus, ...anchorProps } = rest;

  const handlePrefetch = useCallback(() => {
    if (isInternal) prefetch(to);
  }, [isInternal, prefetch, to]);

  function handleClick(event) {
    if (!isInternal) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchorProps.target && anchorProps.target !== '_self') return;
    if (anchorProps.download) return;

    onClick?.(event);
    if (event.defaultPrevented) return;

    event.preventDefault();
    navigate(to, { viewTransition: true });
  }

  function handleMouseEnter(event) {
    onMouseEnter?.(event);
    handlePrefetch();
  }

  function handleFocus(event) {
    onFocus?.(event);
    handlePrefetch();
  }

  return (
    <a
      href={to}
      className={className}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...anchorProps}
    >
      {children}
    </a>
  );
}
