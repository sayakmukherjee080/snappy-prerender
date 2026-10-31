import { ConstellationDiagram } from '../../components/ConstellationDiagram.jsx';
import { LatencyChart } from '../../components/LatencyChart.jsx';
import { Metrics } from '../../components/Metrics.jsx';
import { ProcessSteps } from '../../components/ProcessSteps.jsx';
import { SATELLITES } from '../../content/catalog/satellites.js';
import { STATIONS } from '../../content/catalog/stations.js';
import { LATENCY_ROUTES, NETWORK_METRICS } from '../../content/site.js';
import { Link } from '../../router.jsx';

const HANDOFF_STEPS = [
  {
    title: 'Predict',
    copy: 'Orbit determination forecasts loss of signal to the second, using the node ephemeris and the ground-station mask.',
  },
  {
    title: 'Mirror',
    copy: 'KV cache and session state replicate to the next node at T−90 seconds over the optical crosslink.',
  },
  {
    title: 'Switch',
    copy: 'New tokens route to the receiving node. The old node drains its queue and goes cold.',
  },
  {
    title: 'Confirm',
    copy: 'The client stream continues under the same request ID. No reconnect, no replay, no duplicate billing.',
  },
];

/**
 * Renders the constellation diagram and network metrics.
 */
export function ConstellationWidget() {
  return (
    <div className="widget-stack">
      <ConstellationDiagram />
      <Metrics items={NETWORK_METRICS} />
    </div>
  );
}

/**
 * Renders the ground-station table with links to each station detail page.
 */
export function StationTableWidget() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Ground segment · 8 stations</caption>
        <thead>
          <tr>
            <th scope="col">Station</th>
            <th scope="col">Code</th>
            <th scope="col">Metro</th>
            <th scope="col">p50</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {STATIONS.map((station) => (
            <tr key={station.code}>
              <td>
                <Link className="table-link" to={`/network/ground-stations/${station.slug}`}>
                  {station.name}
                </Link>
                <span className="table-secondary">{station.location}</span>
              </td>
              <td className="mono-cell">{station.code}</td>
              <td>{station.metro}</td>
              <td className="mono-cell">{station.latency} ms</td>
              <td>
                <span className="status-pill">Operational</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders the route latency comparison.
 */
export function LatencyWidget() {
  return (
    <div className="widget-stack">
      <LatencyChart routes={LATENCY_ROUTES} />
      <p className="source-note">
        Modeled p50, including 4 ms of ground processing. Terrestrial figures are public fiber-route
        estimates.
      </p>
    </div>
  );
}

/**
 * Renders the scheduled handoff sequence.
 */
export function HandoffWidget() {
  return <ProcessSteps items={HANDOFF_STEPS} />;
}

/**
 * Renders the active-node telemetry table.
 */
export function TelemetryWidget() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Illustrative snapshot · 2026-10-25 04:12 UTC</caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Plane</th>
            <th scope="col">Status</th>
            <th scope="col">Node load</th>
            <th scope="col">Radiator</th>
            <th scope="col">Optical link</th>
          </tr>
        </thead>
        <tbody>
          {SATELLITES.filter((satellite) => satellite.telemetry).map((satellite) => (
            <tr key={satellite.id}>
              <td className="mono-cell">
                <Link className="table-link" to={`/network/satellites/${satellite.slug}`}>
                  {satellite.id}
                </Link>
              </td>
              <td className="mono-cell">{satellite.plane}</td>
              <td>
                <span
                  className={`status-pill${
                    satellite.status === 'Nominal' ? '' : ' status-pill--warn'
                  }`}
                >
                  {satellite.status}
                </span>
              </td>
              <td>
                <span className="util">
                  <span className="util__track" aria-hidden="true">
                    <span className="util__bar" style={{ width: `${satellite.utilization}%` }} />
                  </span>
                  <span className="util__value">{satellite.utilization}%</span>
                </span>
              </td>
              <td className="mono-cell">{satellite.radiator}</td>
              <td className="mono-cell">{satellite.link}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
