import { useId, useState } from 'react';
import { Accordion } from '../../components/Accordion.jsx';
import { SATELLITES } from '../../content/catalog/satellites.js';
import { STATIONS } from '../../content/catalog/stations.js';

const FAQS = [
  {
    question: 'Is this real orbital infrastructure?',
    answer:
      'This is a fictional demonstration site. The latency, satellite, and pricing data are illustrative; the React application is real.',
  },
  {
    question: 'Do I need a new SDK?',
    answer:
      'No. The API is OpenAI-compatible. Change the base URL and the key, then keep your existing client.',
  },
  {
    question: 'What happens during a handoff?',
    answer:
      'State is mirrored to the next node at T−90 seconds. The client keeps the same request ID and stream.',
  },
  {
    question: 'Is prompt data retained?',
    answer:
      'In the fictional model, no. Prompts are held in HBM for the duration of the response and discarded afterward.',
  },
  {
    question: 'Can I reserve a whole node?',
    answer:
      'Yes. Dedicated deployments reserve a whole node or satellite, with a private ground segment available.',
  },
];

const GLOSSARY = [
  {
    term: 'Plane',
    definition: 'One ring of satellites sharing an orbital inclination and phasing.',
  },
  {
    term: 'Handoff',
    definition: 'The scheduled transfer of a request and its KV cache to another node.',
  },
  {
    term: 'Ground relay',
    definition: 'A station that connects the orbital mesh to a terrestrial fiber metro.',
  },
  {
    term: 'SSO',
    definition: 'Sun-synchronous orbit: a polar orbit with a consistent local solar time.',
  },
  {
    term: 'KV cache',
    definition: 'The attention state kept between decode steps so a stream can continue.',
  },
  { term: 'Eclipse', definition: 'The part of the orbit where the node runs on battery power.' },
  {
    term: 'Optical crosslink',
    definition: 'A laser link between satellites that carries tokens without a ground hop.',
  },
  { term: 'p50', definition: 'The median latency; half of requests are faster, half are slower.' },
];

const RESIDENCY_ROWS = [
  {
    boundary: 'United States',
    station: 'Wallops / Hawaii',
    routing: 'US ground segment',
    status: 'Available',
  },
  {
    boundary: 'European Union',
    station: 'Madrid',
    routing: 'EU ground segment',
    status: 'Available',
  },
  {
    boundary: 'United Kingdom',
    station: 'Svalbard → London',
    routing: 'UK fiber handoff',
    status: 'Available',
  },
  {
    boundary: 'Brazil',
    station: 'Punta Arenas',
    routing: 'South America relay',
    status: 'Available',
  },
  { boundary: 'Singapore', station: 'Perth', routing: 'APAC relay', status: 'Available' },
  {
    boundary: 'Sovereign',
    station: 'Private ground segment',
    routing: 'Customer-defined',
    status: 'Dedicated only',
  },
];

const INCIDENTS = [
  {
    date: '2026-09-28',
    title: 'Madrid fiber maintenance',
    impact: 'EU traffic re-routed through Svalbard for 42 minutes.',
    status: 'Resolved',
  },
  {
    date: '2026-08-14',
    title: 'P5 load spike',
    impact: 'Aether-06 sustained 91% load; no tokens dropped.',
    status: 'Monitoring',
  },
  {
    date: '2026-07-03',
    title: 'Perth acceptance window',
    impact: 'Planned station test; APAC traffic used Awarua.',
    status: 'Planned',
  },
  {
    date: '2026-06-19',
    title: 'Long-context handoff trace',
    impact: 'A 128k request crossed nodes without a reconnect.',
    status: 'Resolved',
  },
  {
    date: '2026-05-22',
    title: 'Ground relay latency',
    impact: 'A fiber path added 8 ms for 12 minutes; SLA unaffected.',
    status: 'Resolved',
  },
];

/**
 * Renders the short FAQ used by the resources page.
 */
export function FaqWidget() {
  return <Accordion items={FAQS} />;
}

/**
 * Renders the orbital vocabulary list.
 */
export function GlossaryWidget() {
  return (
    <dl className="glossary">
      {GLOSSARY.map((entry) => (
        <div key={entry.term}>
          <dt>{entry.term}</dt>
          <dd>{entry.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Renders the current ground and orbital status tables.
 */
export function StatusTable() {
  return (
    <div className="widget-stack">
      <div className="table-wrap">
        <table className="data-table">
          <caption>Ground segment · 8 stations</caption>
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Metro</th>
              <th scope="col">p50</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {STATIONS.map((station) => (
              <tr key={station.code}>
                <td>{station.name}</td>
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

      <div className="table-wrap">
        <table className="data-table">
          <caption>Orbital mesh · 6 active nodes</caption>
          <thead>
            <tr>
              <th scope="col">Node</th>
              <th scope="col">Plane</th>
              <th scope="col">Load</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {SATELLITES.filter((satellite) => satellite.telemetry).map((satellite) => (
              <tr key={satellite.id}>
                <td className="mono-cell">{satellite.id}</td>
                <td className="mono-cell">{satellite.plane}</td>
                <td className="mono-cell">{satellite.utilization}%</td>
                <td>
                  <span
                    className={`status-pill${
                      satellite.status === 'Nominal' ? '' : ' status-pill--warn'
                    }`}
                  >
                    {satellite.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Renders the brand colour and mark reference.
 */
export function BrandKit() {
  return (
    <div className="brand-kit">
      <div className="brand-kit__mark" aria-hidden="true">
        AETHER
      </div>
      <div className="brand-kit__swatches">
        <div>
          <span style={{ background: '#f2f0e9' }} />
          <strong>Paper</strong>
          <code>#F2F0E9</code>
        </div>
        <div>
          <span style={{ background: '#13171a' }} />
          <strong>Ink</strong>
          <code>#13171A</code>
        </div>
        <div>
          <span style={{ background: '#ee5a24' }} />
          <strong>Safety orange</strong>
          <code>#EE5A24</code>
        </div>
        <div>
          <span style={{ background: '#101417' }} />
          <strong>Flight dark</strong>
          <code>#101417</code>
        </div>
      </div>
      <p className="widget-note">
        The orbital mark is used intact. Safety orange is reserved for action and key data.
      </p>
    </div>
  );
}

/**
 * Renders the launch manifest for active and planned nodes.
 */
export function LaunchManifest() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Launch manifest · 24 nodes</caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Plane</th>
            <th scope="col">Launch</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {SATELLITES.map((satellite) => (
            <tr key={satellite.id}>
              <td className="mono-cell">{satellite.id}</td>
              <td className="mono-cell">{satellite.plane}</td>
              <td className="mono-cell">{satellite.launch}</td>
              <td>
                <span className={`status-pill${satellite.telemetry ? '' : ' status-pill--warn'}`}>
                  {satellite.telemetry ? 'On orbit' : satellite.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders a circular-orbit period and round-trip calculator.
 */
export function OrbitCalculator() {
  const [altitude, setAltitude] = useState(550);
  const sliderId = useId();
  const radius = 6371 + altitude;
  const periodMinutes = (2 * Math.PI * Math.sqrt(radius ** 3 / 398600.4418)) / 60;
  const roundTrip = (2 * altitude) / 299.792;

  return (
    <div className="orbit-calculator">
      <div className="orbit-calculator__controls">
        <label className="mono-label" htmlFor={sliderId}>
          Altitude · {altitude} km
        </label>
        <input
          id={sliderId}
          type="range"
          min="200"
          max="1200"
          step="10"
          value={altitude}
          onChange={(event) => setAltitude(Number(event.target.value))}
        />
        <div className="calculator__scale">
          <span>200 km</span>
          <span>1,200 km</span>
        </div>
      </div>
      <dl className="orbit-calculator__output">
        <div>
          <dt>Orbital period</dt>
          <dd>{periodMinutes.toFixed(1)} min</dd>
        </div>
        <div>
          <dt>Vacuum round trip</dt>
          <dd>{roundTrip.toFixed(2)} ms</dd>
        </div>
        <div>
          <dt>Orbit class</dt>
          <dd>{altitude < 2000 ? 'LEO' : 'MEO'}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Renders the ground-segment residency boundaries.
 */
export function ResidencyTable() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Residency boundaries</caption>
        <thead>
          <tr>
            <th scope="col">Boundary</th>
            <th scope="col">Station</th>
            <th scope="col">Routing</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {RESIDENCY_ROWS.map((row) => (
            <tr key={row.boundary}>
              <td>{row.boundary}</td>
              <td>{row.station}</td>
              <td>{row.routing}</td>
              <td>
                <span
                  className={`status-pill${row.status === 'Dedicated only' ? ' status-pill--warn' : ''}`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders the public incident log.
 */
export function IncidentHistory() {
  return (
    <ol className="incident-list">
      {INCIDENTS.map((incident) => (
        <li key={`${incident.date}-${incident.title}`}>
          <div className="incident-list__meta">
            <span>{incident.date}</span>
            <span>{incident.status}</span>
          </div>
          <h3>{incident.title}</h3>
          <p>{incident.impact}</p>
        </li>
      ))}
    </ol>
  );
}
