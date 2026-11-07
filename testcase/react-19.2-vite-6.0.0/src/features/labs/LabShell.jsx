/**
 * Renders the shared shell for an unlisted lab demo.
 * @param {{ title: string, summary: string, tags?: string[], notes?: string[], children: unknown }} props
 */
export function LabShell({ title, summary, tags = [], notes = [], children }) {
  return (
    <article className="lab-page">
      <header className="lab-page__head">
        <p className="eyebrow">Lab / Experiment</p>
        <h1>{title}</h1>
        <p className="lede">{summary}</p>
        {tags.length > 0 && (
          <div className="chip-row">
            {tags.map((tag) => (
              <span className="chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="lab-page__body">{children}</div>

      {notes.length > 0 && (
        <aside className="lab-page__notes">
          <p className="mono-label">What to look for</p>
          <ul className="content-list">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
