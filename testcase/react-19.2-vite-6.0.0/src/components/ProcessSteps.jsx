/**
 * Renders a numbered sequence for inference, handoff, or deployment steps.
 * @param {{ items: Array<{ title: string, copy: string }> }} props
 */
export function ProcessSteps({ items }) {
  return (
    <ol className="process">
      {items.map((item, index) => (
        <li className="process__step" key={item.title}>
          <span className="process__index">{String(index + 1).padStart(2, '0')}</span>
          <div className="process__body">
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
