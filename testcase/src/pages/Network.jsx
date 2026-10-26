import {
  ConstellationDiagram,
  CTASection,
  LatencyChart,
  Metrics,
  PageHero,
  ProcessSteps,
  SectionHead,
} from '../components/index.js';
import {
  GROUND_STATIONS,
  LATENCY_ROUTES,
  NETWORK_METRICS,
  SATELLITES,
  SECTION_IDS,
} from '../content/site.js';
import { usePageMeta } from '../hooks/usePageMeta.js';

const HANDOFF_STEPS = [
  {
    title: 'Predict',
    copy: 'Orbit determination forecasts loss of signal to the second, using the node’s ephemeris and the ground-station mask.',
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
 * Renders the constellation, ground segment, route latency, handoff sequence, and telemetry.
 */
export default function Network() {
  usePageMeta({
    title: 'Network',
    description:
      'Twenty-four satellites, six orbital planes, eight ground stations, and an optical mesh that routes LLM inference around the horizon.',
  });

  return (
    <>
      <PageHero
        index="03"
        label="Network"
        title={
          <>
            A mesh
            <br />
            with a view.
          </>
        }
        lede="Twenty-four satellites in six planes, linked by laser and anchored by eight ground stations. The constellation is the datacenter."
        meta={[
          { label: 'Satellites', value: '24 planned · 6 active' },
          { label: 'Ground', value: '8 stations' },
          { label: 'Inclination', value: '97.6° SSO' },
        ]}
      />

      <div className="metric-band">
        <div className="shell">
          <Metrics items={NETWORK_METRICS} />
        </div>
      </div>

      <section className="section" id={SECTION_IDS.constellation}>
        <div className="shell">
          <SectionHead
            index="01"
            label="Constellation"
            title={
              <>
                One constellation,
                <br />
                six planes.
              </>
            }
            lede="Each plane is a ring of four satellites at 550 km and 97.6° inclination. Crosslinks connect neighbours in and across planes, so a request can travel from Svalbard to Hawaii without touching the ground."
          />

          <ConstellationDiagram />
          <p className="source-note">
            Diagram is illustrative. Orbital positions are not to scale; plane phasing is
            simplified.
          </p>
        </div>
      </section>

      <section className="section" id={SECTION_IDS.groundSegment}>
        <div className="shell">
          <SectionHead
            index="02"
            label="Ground segment"
            title={
              <>
                Eight stations.
                <br />
                One fiber handoff.
              </>
            }
            lede="Every station is a private cage with redundant power, a 7.3-metre Ka-band antenna, and a direct fiber path to the metro it serves."
          />

          <div className="table-wrap">
            <table className="data-table">
              <caption>Ground segment · 8 stations · 8 nominal</caption>
              <thead>
                <tr>
                  <th scope="col">Station</th>
                  <th scope="col">Code</th>
                  <th scope="col">Coordinates</th>
                  <th scope="col">Metro</th>
                  <th scope="col">p50</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {GROUND_STATIONS.map((station) => (
                  <tr key={station.code}>
                    <td>
                      <span className="table-primary">{station.name}</span>
                      <span className="table-secondary">{station.location}</span>
                    </td>
                    <td className="mono-cell">{station.code}</td>
                    <td className="mono-cell">{station.coordinates}</td>
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

          <p className="source-note">
            Latency is modeled p50 from station ingress to metro exchange, including 4 ms of ground
            processing.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="03"
            label="Routes"
            title={
              <>
                The route matters
                <br />
                more than the distance.
              </>
            }
            lede="Fiber follows land, rights of way, and switching centres. The orbital path follows the great circle. For long east–west routes, that is the difference between 18 and 31 milliseconds."
          />

          <LatencyChart routes={LATENCY_ROUTES} />
          <p className="source-note">
            Modeled p50, including 4 ms of ground processing. Terrestrial figures are public
            fiber-route estimates.
          </p>
        </div>
      </section>

      <section className="section section--dark">
        <div className="shell">
          <SectionHead
            index="04"
            label="Handoff"
            title={
              <>
                The horizon is
                <br />a scheduled event.
              </>
            }
            lede="Nothing about a handoff is reactive. The constellation knows where it will be in ninety seconds, and so does your stream."
          />

          <div className="process-layout">
            <ProcessSteps items={HANDOFF_STEPS} />

            <aside className="process-aside process-aside--dark">
              <p className="mono-label">Handoff window</p>
              <div className="process-aside__row">
                <span>Lead time</span>
                <strong>90 s</strong>
              </div>
              <div className="process-aside__row">
                <span>State replicated</span>
                <strong>2.4 GB</strong>
              </div>
              <div className="process-aside__row">
                <span>Stream interruption</span>
                <strong>0 ms</strong>
              </div>
              <p className="process-aside__note">
                Handoffs run continuously across the constellation, not only at ground-station
                boundaries.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="section" id={SECTION_IDS.telemetry}>
        <div className="shell">
          <SectionHead
            index="05"
            label="Telemetry"
            title={
              <>
                A snapshot
                <br />
                from the mesh.
              </>
            }
            lede="Six nodes, one moment. Production telemetry is available to customers over the API; this page shows an illustrative snapshot."
          />

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
                {SATELLITES.map((satellite) => (
                  <tr key={satellite.id}>
                    <td className="mono-cell">{satellite.id}</td>
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
                          <span
                            className="util__bar"
                            style={{ width: `${satellite.utilization}%` }}
                          />
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

          <p className="source-note">
            This is not a live feed. No customer prompts or outputs appear in network telemetry.
          </p>
        </div>
      </section>

      <CTASection />
    </>
  );
}
