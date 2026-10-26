/**
 * Renders a labelled, horizontally scrollable code sample on a dark panel.
 * @param {{ label: string, code: string, note?: string }} props
 */
export function CodeBlock({ label, code, note }) {
  return (
    <figure className="code">
      <figcaption className="code__head">
        <span className="code__dot" aria-hidden="true" />
        {label}
      </figcaption>
      <pre className="code__body">
        <code>{code}</code>
      </pre>
      {note && <p className="code__note">{note}</p>}
    </figure>
  );
}
