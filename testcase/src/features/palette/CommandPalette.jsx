import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap, useScrollLock } from '../../hooks/useFocus.js';
import { matchRoute, useRouter } from '../../router.jsx';
import { useHiddenAccess } from '../hidden/hooks.js';
import { hiddenStore } from '../hidden/store.js';
import { setFeatureFlag, setVariant, useFeatureFlag, useVariant } from '../preferences/hooks.js';

/**
 * Renders the global route search dialog with keyboard navigation and preference controls.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function CommandPalette({ open, onClose }) {
  const { routes, navigate } = useRouter();
  const hiddenUnlocked = useHiddenAccess();
  const showHidden = useFeatureFlag('showHidden');
  const telemetry = useFeatureFlag('telemetry');
  const variant = useVariant();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const generatedId = useId();
  const baseId = `palette-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const titleId = `${baseId}-title`;
  const listId = `${baseId}-list`;

  const items = useMemo(() => {
    const list = [];
    for (const route of routes) {
      const paths = route.staticPaths ?? [route.path];
      for (const path of paths) {
        if (route.hidden && !(hiddenUnlocked && showHidden)) continue;
        const matched = matchRoute([route], path);
        const meta = route.meta?.(matched?.params ?? {}) ?? {};
        list.push({
          path,
          title: meta.title ?? path,
          group: route.group ?? 'page',
          hidden: Boolean(route.hidden),
        });
      }
    }
    return list;
  }, [routes, hiddenUnlocked, showHidden]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const matches = needle
      ? items.filter((item) =>
          `${item.title} ${item.path} ${item.group}`.toLowerCase().includes(needle),
        )
      : items;
    return matches.slice(0, 24);
  }, [items, deferredQuery]);

  useScrollLock(open);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(0);
      return undefined;
    }

    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      root?.removeAttribute('inert');
    };
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the active option when the deferred query changes.
  useEffect(() => {
    setSelected(0);
  }, [deferredQuery]);

  useEffect(() => {
    if (!open || filtered.length === 0) return;
    const option = document.getElementById(`${baseId}-option-${selected}`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [baseId, filtered.length, open, selected]);

  /**
   * Navigates to the selected route and closes the palette.
   * @param {{ path: string }} item
   */
  function selectItem(item) {
    navigate(item.path, { viewTransition: true });
    onClose();
  }

  /**
   * Handles arrow keys, enter, and escape from the search input.
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[selected]) selectItem(filtered[selected]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismissal is supplemental; the dialog has a close button.
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="palette__head">
          <p id={titleId} className="mono-label">
            Route palette
          </p>
          <span className="palette__count" aria-live="polite">
            {filtered.length} of {items.length} routes
          </span>
          <button type="button" className="palette__close" onClick={onClose}>
            Esc
          </button>
        </div>

        <input
          ref={inputRef}
          className="palette__input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search all routes…"
          aria-label="Search routes"
          aria-controls={listId}
          autoComplete="off"
          spellCheck="false"
        />

        <fieldset className="palette__list" id={listId} aria-label="Route results">
          {filtered.map((item, index) => (
            <button
              key={item.path}
              id={`${baseId}-option-${index}`}
              type="button"
              className={`palette__item${index === selected ? ' palette__item--active' : ''}`}
              aria-current={index === selected ? 'true' : undefined}
              tabIndex={-1}
              onMouseEnter={() => setSelected(index)}
              onClick={() => selectItem(item)}
            >
              <span className="palette__item-title">{item.title}</span>
              <span className="palette__item-path">{item.path}</span>
              {item.hidden && <span className="palette__item-hidden">hidden</span>}
            </button>
          ))}
        </fieldset>

        {filtered.length === 0 && (
          <p className="palette__empty">
            No route matches “{deferredQuery}”. Try a group name, a satellite, or “lab”.
          </p>
        )}

        <div className="palette__foot">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <div className="palette__actions">
            <button
              type="button"
              className="palette__action"
              aria-pressed={telemetry}
              onClick={() => setFeatureFlag('telemetry', !telemetry)}
            >
              Telemetry {telemetry ? 'on' : 'off'}
            </button>
            <button
              type="button"
              className="palette__action"
              aria-pressed={variant === 'b'}
              onClick={() => setVariant(variant === 'a' ? 'b' : 'a')}
            >
              Variant {variant.toUpperCase()}
            </button>
            {hiddenUnlocked && (
              <>
                <button
                  type="button"
                  className="palette__action"
                  aria-pressed={showHidden}
                  onClick={() => setFeatureFlag('showHidden', !showHidden)}
                >
                  Hidden {showHidden ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  className="palette__action"
                  onClick={() => hiddenStore.lock()}
                >
                  Lock lab
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
