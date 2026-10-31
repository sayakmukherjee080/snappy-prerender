import {
  GROUND_STATIONS,
  LATENCY_ROUTES,
  NETWORK_METRICS,
  SATELLITES,
  SECTION_IDS,
} from '../content/site.js';
import { ctaSection, latencyChart, metrics, pageHero, processSteps, sectionHead } from './base.js';
import { constellationDiagram } from './diagrams.js';

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
 * @returns {string}
 */
export function networkPage() {
  return `${pageHero({
    index: '03',
    label: 'Network',
    title: 'A mesh<br />with a view.',
    lede: 'Twenty-four satellites in six planes, linked by laser and anchored by eight ground stations. The constellation is the datacenter.',
    meta: [
      { label: 'Satellites', value: '24 planned · 6 active' },
      { label: 'Ground', value: '8 stations' },
      { label: 'Inclination', value: '97.6° SSO' },
    ],
  })}

<div class="metric-band"><div class="shell">${metrics(NETWORK_METRICS)}</div></div>

<section class="section" id="${SECTION_IDS.constellation}"><div class="shell">
  ${sectionHead({
    index: '01',
    label: 'Constellation',
    title: 'One constellation,<br />six planes.',
    lede: 'Each plane is a ring of four satellites at 550 km and 97.6° inclination. Crosslinks connect neighbours in and across planes, so a request can travel from Svalbard to Hawaii without touching the ground.',
  })}
  ${constellationDiagram()}
  <p class="source-note">Diagram is illustrative. Orbital positions are not to scale; plane phasing is simplified.</p>
</div></section>

<section class="section" id="${SECTION_IDS.groundSegment}"><div class="shell">
  ${sectionHead({
    index: '02',
    label: 'Ground segment',
    title: 'Eight stations.<br />One fiber handoff.',
    lede: 'Every station is a private cage with redundant power, a 7.3-metre Ka-band antenna, and a direct fiber path to the metro it serves.',
  })}
  <div class="table-wrap"><table class="data-table">
    <caption>Ground segment · 8 stations · 8 nominal</caption>
    <thead><tr><th scope="col">Station</th><th scope="col">Code</th><th scope="col">Coordinates</th><th scope="col">Metro</th><th scope="col">p50</th><th scope="col">Status</th></tr></thead>
    <tbody>${GROUND_STATIONS.map(
      (station) => `<tr>
      <td><span class="table-primary">${station.name}</span><span class="table-secondary">${station.location}</span></td>
      <td class="mono-cell">${station.code}</td>
      <td class="mono-cell">${station.coordinates}</td>
      <td>${station.metro}</td>
      <td class="mono-cell">${station.latency} ms</td>
      <td><span class="status-pill">Operational</span></td>
    </tr>`,
    ).join('')}</tbody>
  </table></div>
  <p class="source-note">Latency is modeled p50 from station ingress to metro exchange, including 4 ms of ground processing.</p>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '03',
    label: 'Routes',
    title: 'The route matters<br />more than the distance.',
    lede: 'Fiber follows land, rights of way, and switching centres. The orbital path follows the great circle. For long east–west routes, that is the difference between 18 and 31 milliseconds.',
  })}
  ${latencyChart(LATENCY_ROUTES)}
  <p class="source-note">Modeled p50, including 4 ms of ground processing. Terrestrial figures are public fiber-route estimates.</p>
</div></section>

<section class="section section--dark"><div class="shell">
  ${sectionHead({
    index: '04',
    label: 'Handoff',
    title: 'The horizon is<br />a scheduled event.',
    lede: 'Nothing about a handoff is reactive. The constellation knows where it will be in ninety seconds, and so does your stream.',
  })}
  <div class="process-layout">
    ${processSteps(HANDOFF_STEPS)}
    <aside class="process-aside process-aside--dark">
      <p class="mono-label">Handoff window</p>
      <div class="process-aside__row"><span>Lead time</span><strong>90 s</strong></div>
      <div class="process-aside__row"><span>State replicated</span><strong>2.4 GB</strong></div>
      <div class="process-aside__row"><span>Stream interruption</span><strong>0 ms</strong></div>
      <p class="process-aside__note">Handoffs run continuously across the constellation, not only at ground-station boundaries.</p>
    </aside>
  </div>
</div></section>

<section class="section" id="${SECTION_IDS.telemetry}"><div class="shell">
  ${sectionHead({
    index: '05',
    label: 'Telemetry',
    title: 'A snapshot<br />from the mesh.',
    lede: 'Six nodes, one moment. Production telemetry is available to customers over the API; this page shows an illustrative snapshot.',
  })}
  <div class="table-wrap"><table class="data-table">
    <caption>Illustrative snapshot · 2026-10-25 04:12 UTC</caption>
    <thead><tr><th scope="col">Node</th><th scope="col">Plane</th><th scope="col">Status</th><th scope="col">Node load</th><th scope="col">Radiator</th><th scope="col">Optical link</th></tr></thead>
    <tbody>${SATELLITES.map(
      (satellite) => `<tr>
      <td class="mono-cell">${satellite.id}</td>
      <td class="mono-cell">${satellite.plane}</td>
      <td><span class="status-pill${satellite.status === 'Nominal' ? '' : ' status-pill--warn'}">${satellite.status}</span></td>
      <td><span class="util"><span class="util__track" aria-hidden="true"><span class="util__bar" style="width:${satellite.utilization}%"></span></span><span class="util__value">${satellite.utilization}%</span></span></td>
      <td class="mono-cell">${satellite.radiator}</td>
      <td class="mono-cell">${satellite.link}</td>
    </tr>`,
    ).join('')}</tbody>
  </table></div>
  <p class="source-note">This is not a live feed. No customer prompts or outputs appear in network telemetry.</p>
</div></section>

${ctaSection()}`;
}
