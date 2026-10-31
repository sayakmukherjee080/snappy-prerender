/**
 * Renders the ruled metric band used on the home and network pages.
 * @param {{ items: Array<{ value: string, unit?: string, label: string }> }} props
 */
export function Metrics({ items }) {
  return (
    <dl className="metrics">
      {items.map((item) => (
        <div className="metrics__item" key={item.label}>
          <dt className="metrics__label">{item.label}</dt>
          <dd className="metrics__value">
            {item.value}
            {item.unit && <span className="metrics__unit">{item.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
