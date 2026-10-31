import { useId, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap, useScrollLock } from '../../hooks/useFocus.js';
import { LabShell } from './LabShell.jsx';

/**
 * A dialog that exposes open, close, and focus through an imperative ref.
 * @param {{ ref: { current: object | null } }} props
 */
function Dialog({ ref }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const titleId = useId();
  const inputId = useId();

  useImperativeHandle(
    ref,
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      focus: () => dialogRef.current?.focus(),
    }),
    [],
  );

  useScrollLock(open);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismissal is supplemental; the dialog has a close button.
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
    >
      <div
        className="dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <p className="mono-label">Imperative dialog</p>
        <h2 id={titleId}>Open by ref, not by prop.</h2>
        <p>
          The parent calls <code>dialogRef.current.open()</code>. The dialog owns its focus trap and
          scroll lock.
        </p>
        <label className="lab-field" htmlFor={inputId}>
          <span>Try the focus trap</span>
          <input id={inputId} type="text" placeholder="Tab stays inside the dialog" />
        </label>
        <div className="lab-controls">
          <button type="button" className="button" onClick={() => setOpen(false)}>
            Close
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => dialogRef.current?.focus()}
          >
            Focus panel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Demonstrates useImperativeHandle with React 19's ref-as-prop support.
 */
export default function ImperativeDialogLab() {
  const dialogRef = useRef(null);

  return (
    <LabShell
      title="Imperative dialog"
      summary="A dialog with an imperative API, a focus trap, a scroll lock, and a portal."
      tags={['useImperativeHandle', 'ref prop', 'focus trap', 'createPortal']}
      notes={[
        'The parent never passes an open prop; it calls methods on the ref.',
        'The dialog owns its focus trap and body scroll lock.',
        'Tab and shift-tab stay inside the dialog while it is open.',
      ]}
    >
      <div className="lab-demo">
        <div className="lab-controls">
          <button
            type="button"
            className="button button--orange"
            onClick={() => dialogRef.current?.open()}
          >
            Open dialog
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => dialogRef.current?.close()}
          >
            Close dialog
          </button>
        </div>
        <p className="widget-note">
          The ref exposes <code>open</code>, <code>close</code>, and <code>focus</code>. There is no
          controlled <code>open</code> prop.
        </p>
        <Dialog ref={dialogRef} />
      </div>
    </LabShell>
  );
}
