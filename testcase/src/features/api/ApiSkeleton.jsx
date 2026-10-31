/**
 * Renders a stable loading shell for an API-backed page.
 */
export function ApiSkeleton() {
  return (
    <section className="api-skeleton" aria-busy="true" aria-label="Loading API content">
      <div className="api-skeleton__eyebrow" />
      <div className="api-skeleton__title" />
      <div className="api-skeleton__grid">
        <div />
        <div />
        <div />
      </div>
      <div className="api-skeleton__body" />
      <div className="api-skeleton__body api-skeleton__body--short" />
    </section>
  );
}
