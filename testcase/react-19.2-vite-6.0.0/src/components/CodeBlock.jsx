import { useToast } from '../features/toast/ToastProvider.jsx';

/**
 * Renders a labelled, horizontally scrollable code sample on a dark panel with a copy action.
 * @param {{ label: string, code: string, note?: string }} props
 */
export function CodeBlock({ label, code, note }) {
  const { addToast } = useToast();

  /**
   * Copies the code sample to the clipboard and reports the outcome.
   */
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      addToast('Code copied to clipboard.', 'success');
    } catch {
      addToast('Clipboard is unavailable in this browser.', 'warning');
    }
  }

  return (
    <figure className="code">
      <figcaption className="code__head">
        <span className="code__dot" aria-hidden="true" />
        <span>{label}</span>
        <button type="button" className="code__copy" onClick={copyCode}>
          Copy
        </button>
      </figcaption>
      <pre className="code__body">
        <code>{code}</code>
      </pre>
      {note && <p className="code__note">{note}</p>}
    </figure>
  );
}
