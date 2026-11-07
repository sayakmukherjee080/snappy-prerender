/**
 * Renders the numbered masthead shared by the Platform, Network, Pricing, and Company pages.
 * @param {{ index: string, label: string, title: unknown, lede: string, meta?: Array<{ label: string, value: string }> }} props
 */
export function PageHero({ index, label, title, lede, meta = [] }) {
  return (
    <section className="page-hero">
      <div className="shell">
        <p className="eyebrow">
          <span className="eyebrow__index">{index}</span>
          {label}
        </p>

        <div className="page-hero__grid">
          <h1>{title}</h1>
          <div className="page-hero__aside">
            <p className="lede">{lede}</p>
          </div>
        </div>

        {meta.length > 0 && (
          <dl className="page-hero__meta">
            {meta.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
