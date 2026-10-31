/**
 * Renders a compact status badge with a semantic tone.
 * @param {{ label: string, tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }} props
 */
export function StatusBadge({ label, tone = 'neutral' }) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
