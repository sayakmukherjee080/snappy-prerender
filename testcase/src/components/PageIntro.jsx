import { StatusBadge } from './StatusBadge.jsx';

/**
 * Renders the shared sub-page masthead with an eyebrow, title, summary, badge, and metadata.
 * @param {{ eyebrow: string, title: unknown, summary: string, meta?: Array<{ label: string, value: string }>, badge?: { label: string, tone?: string }, actions?: unknown }} props
 */
export function PageIntro({ eyebrow, title, summary, meta = [], badge, actions }) {
  return (
    <header className="page-intro">
      <div className="shell">
        <p className="eyebrow">{eyebrow}</p>
        <div className="page-intro__grid">
          <h1>{title}</h1>
          <div className="page-intro__aside">
            <p className="lede">{summary}</p>
            {badge && <StatusBadge label={badge.label} tone={badge.tone} />}
            {actions}
          </div>
        </div>

        {meta.length > 0 && (
          <dl className="page-intro__meta">
            {meta.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}
