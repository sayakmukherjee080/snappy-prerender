/**
 * Renders paired orbital and terrestrial latency bars for a set of routes.
 * @param {{ routes: Array<{ id: string, from: string, to: string, orbital: number, fiber: number }> }} props
 */
export function LatencyChart({ routes }) {
  const maxLatency = Math.max(...routes.flatMap((route) => [route.orbital, route.fiber]));

  return (
    <div className="latency">
      <div className="latency__key">
        <span>
          <i className="latency__dot latency__dot--orbital" aria-hidden="true" /> Aether orbital
        </span>
        <span>
          <i className="latency__dot latency__dot--fiber" aria-hidden="true" /> Terrestrial fiber
        </span>
      </div>

      {routes.map((route) => (
        <div className="latency__row" key={route.id}>
          <div className="latency__route">
            <span>{route.from}</span>
            <span className="latency__arrow" aria-hidden="true">
              →
            </span>
            <span>{route.to}</span>
          </div>

          <div className="latency__bar-line">
            <span className="latency__bar-label">Orbital</span>
            <span className="latency__track" aria-hidden="true">
              <span
                className="latency__bar latency__bar--orbital"
                style={{ width: `${(route.orbital / maxLatency) * 100}%` }}
              />
            </span>
            <span className="latency__bar-value">{route.orbital} ms</span>
          </div>

          <div className="latency__bar-line">
            <span className="latency__bar-label">Fiber</span>
            <span className="latency__track" aria-hidden="true">
              <span
                className="latency__bar latency__bar--fiber"
                style={{ width: `${(route.fiber / maxLatency) * 100}%` }}
              />
            </span>
            <span className="latency__bar-value">{route.fiber} ms</span>
          </div>
        </div>
      ))}
    </div>
  );
}
