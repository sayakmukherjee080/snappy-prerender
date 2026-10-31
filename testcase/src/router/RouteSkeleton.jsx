/**
 * Renders a stable loading shell while a lazy route chunk resolves.
 */
export function RouteSkeleton() {
  return (
    <section className="route-skeleton" aria-busy="true" aria-label="Loading page">
      <span className="sr-only">Loading page</span>
      <div className="route-skeleton__eyebrow" />
      <div className="route-skeleton__title" />
      <div className="route-skeleton__title route-skeleton__title--short" />
      <div className="route-skeleton__grid">
        <div />
        <div />
        <div />
      </div>
      <div className="route-skeleton__body" />
      <div className="route-skeleton__body route-skeleton__body--short" />
    </section>
  );
}
