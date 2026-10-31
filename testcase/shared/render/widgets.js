import { MODELS } from '../content/catalog/models.js';
import { SATELLITES } from '../content/catalog/satellites.js';
import { STATIONS } from '../content/catalog/stations.js';
import { COMPARISON_ROWS } from '../content/pricing.js';
import { CONTACT, JOBS, LATENCY_ROUTES, NETWORK_METRICS, TEAM } from '../content/site.js';
import { estimateMonthlyCost } from '../lib/estimate.js';
import { formatDollars } from '../lib/format.js';
import { esc, latencyChart, metrics, processSteps } from './base.js';
import { constellationDiagram } from './diagrams.js';

const FAQS = [
  {
    question: 'Is this real orbital infrastructure?',
    answer:
      'This is a fictional demonstration site. The latency, satellite, and pricing data are illustrative; the application is real.',
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
 * Renders an accordion with the first item open.
 * @param {Array<{ question: string, answer: string }>} items
 * @returns {string}
 */
function accordion(items) {
  return `<div class="accordion" data-island="accordion">${items
    .map(
      (item, index) => `<div class="accordion__item">
    <h3 class="accordion__heading"><button type="button" class="accordion__button" aria-expanded="${
      index === 0
    }" aria-controls="accordion-panel-${index}">
      <span class="accordion__index">${String(index + 1).padStart(2, '0')}</span>
      <span class="accordion__question">${esc(item.question)}</span>
      <span class="accordion__icon" aria-hidden="true">${index === 0 ? '−' : '+'}</span>
    </button></h3>
    <section class="accordion__panel" id="accordion-panel-${index}" ${
      index === 0 ? '' : 'hidden'
    }><p>${esc(item.answer)}</p></section>
  </div>`,
    )
    .join('')}</div>`;
}

/**
 * Renders the validated contact form.
 * @returns {string}
 */
function contactForm() {
  const topics = ['Capacity', 'Partnership', 'Press', 'Careers'];
  return `<form class="form" data-island="contact-form" novalidate>
  <div class="field"><label for="contact-name">Name</label><input id="contact-name" name="name" type="text" autocomplete="name" maxlength="80" required /><span class="field__error" data-error="name" hidden></span></div>
  <div class="field"><label for="contact-email">Work email</label><input id="contact-email" name="email" type="email" autocomplete="email" maxlength="120" required /><span class="field__error" data-error="email" hidden></span></div>
  <div class="field"><label for="contact-company">Company</label><input id="contact-company" name="company" type="text" autocomplete="organization" maxlength="100" /></div>
  <div class="field"><label for="contact-topic">Topic</label><select id="contact-topic" name="topic">${topics
    .map((topic) => `<option value="${topic}">${topic}</option>`)
    .join('')}</select></div>
  <div class="field field--full"><label for="contact-message">Message</label><textarea id="contact-message" name="message" rows="5" maxlength="2000" required></textarea><span class="field__error" data-error="message" hidden></span></div>
  <div class="form__actions field--full"><button type="submit" class="button button--orange">Compose message <span aria-hidden="true">↗</span></button><p class="form__note">This opens your mail client. Nothing is stored on this site.</p></div>
  <p class="form__status field--full" aria-live="polite" data-form-status></p>
</form>`;
}

/**
 * Renders the token-volume estimator.
 * @param {boolean} reserved
 * @param {boolean} showToggle
 * @returns {string}
 */
function pricingCalculator(reserved = false, showToggle = true) {
  const volume = 50;
  const estimate = estimateMonthlyCost(volume, reserved);
  return `<div class="calculator" data-island="pricing-calculator" data-reserved="${reserved}" data-show-toggle="${showToggle}">
  <div class="calculator__controls">
    ${
      showToggle
        ? `<fieldset class="pricing-toggle calculator__toggle" aria-label="Billing period"><button type="button" data-reserved-option="false" aria-pressed="${!reserved}">On-demand</button><button type="button" data-reserved-option="true" aria-pressed="${reserved}">Reserved · save 20%</button></fieldset>`
        : ''
    }
    <label class="mono-label" for="token-volume">Monthly tokens</label>
    <div class="calculator__value" data-volume-value>${volume}<span>M</span></div>
    <input id="token-volume" type="range" min="1" max="500" step="1" value="${volume}" data-volume-slider />
    <div class="calculator__scale"><span>1M</span><span>500M</span></div>
    <p class="calculator__assumption" data-assumption>${
      reserved ? 'Reserved rates applied.' : 'On-demand rates applied.'
    } Input and output are metered separately; the estimator uses a 70/30 mix.</p>
  </div>
  <div class="calculator__output">
    <p class="mono-label">Estimated monthly</p>
    <div class="calculator__row"><span>Developer</span><strong data-estimate="developer">${formatDollars(
      estimate.developer,
    )}</strong></div>
    <div class="calculator__row"><span>Scale</span><strong data-estimate="scale">${formatDollars(
      estimate.scale,
    )}</strong></div>
    <div class="calculator__row"><span>Dedicated</span><strong>Custom</strong></div>
    <p class="calculator__recommendation">Best fit <strong data-estimate="recommendation">${esc(
      estimate.recommendation,
    )}</strong></p>
    <p class="calculator__note">Estimates exclude taxes. A dedicated node starts at $180,000 per month.</p>
  </div>
</div>`;
}

/**
 * Renders a circular-orbit period and round-trip calculator.
 * @returns {string}
 */
function orbitCalculator() {
  const altitude = 550;
  const radius = 6371 + altitude;
  const period = (2 * Math.PI * Math.sqrt(radius ** 3 / 398600.4418)) / 60;
  const roundTrip = (2 * altitude) / 299.792;
  return `<div class="orbit-calculator" data-island="orbit-calculator">
  <div class="orbit-calculator__controls">
    <label class="mono-label" for="orbit-altitude">Altitude · <span data-altitude-label>${altitude}</span> km</label>
    <input id="orbit-altitude" type="range" min="200" max="1200" step="10" value="${altitude}" data-altitude-slider />
    <div class="calculator__scale"><span>200 km</span><span>1,200 km</span></div>
  </div>
  <dl class="orbit-calculator__output">
    <div><dt>Orbital period</dt><dd data-orbit-period>${period.toFixed(1)} min</dd></div>
    <div><dt>Vacuum round trip</dt><dd data-orbit-trip>${roundTrip.toFixed(2)} ms</dd></div>
    <div><dt>Orbit class</dt><dd data-orbit-class>LEO</dd></div>
  </dl>
</div>`;
}

/**
 * Renders a data table.
 * @param {string} caption
 * @param {string[]} head
 * @param {string[]} rows
 * @param {string} className
 * @returns {string}
 */
function table(caption, head, rows, className = '') {
  return `<div class="table-wrap${className ? ` ${className}` : ''}"><table class="data-table">
  <caption>${esc(caption)}</caption>
  <thead><tr>${head.map((cell) => `<th scope="col">${esc(cell)}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody>
</table></div>`;
}

/**
 * Renders the widget requested by a detail record.
 * @param {string} key
 * @returns {string}
 */
export function widgetMarkup(key) {
  switch (key) {
    case 'pricing-calculator':
      return pricingCalculator(false, true);
    case 'pricing-compare':
      return table(
        'Plan comparison',
        ['Feature', 'Developer', 'Scale', 'Dedicated'],
        COMPARISON_ROWS.map(
          (row) =>
            `<tr><th scope="row">${esc(row.label)}</th><td>${esc(row.developer)}</td><td>${esc(
              row.scale,
            )}</td><td>${esc(row.dedicated)}</td></tr>`,
        ),
        'widget-table',
      );
    case 'team-grid':
      return `<div class="team-grid widget-team">${TEAM.map(
        (person) =>
          `<article class="person"><div class="person__portrait" aria-hidden="true"><span>${esc(
            person.initials,
          )}</span></div><h3>${esc(person.name)}</h3><p class="person__role">${esc(
            person.role,
          )}</p><p class="person__bio">${esc(person.bio)}</p></article>`,
      ).join('')}</div>`;
    case 'jobs-list':
      return `<div class="jobs widget-jobs">${JOBS.map(
        (job) =>
          `<a class="job" href="mailto:${esc(CONTACT.careers)}?subject=${encodeURIComponent(
            job.subject,
          )}"><h3>${esc(job.title)}</h3><span class="job__meta">${esc(
            job.location,
          )}</span><span class="job__meta">${esc(job.type)}</span><span class="job__arrow" aria-hidden="true">↗</span></a>`,
      ).join('')}</div>`;
    case 'contact-form':
      return contactForm();
    case 'faq':
      return accordion(FAQS);
    case 'glossary':
      return `<dl class="glossary">${GLOSSARY.map(
        (entry) => `<div><dt>${esc(entry.term)}</dt><dd>${esc(entry.definition)}</dd></div>`,
      ).join('')}</dl>`;
    case 'status-table':
      return `<div class="widget-stack">${table(
        'Ground segment · 8 stations',
        ['Station', 'Metro', 'p50', 'Status'],
        STATIONS.map(
          (station) =>
            `<tr><td>${esc(station.name)}</td><td>${esc(station.metro)}</td><td class="mono-cell">${
              station.latency
            } ms</td><td><span class="status-pill">Operational</span></td></tr>`,
        ),
      )}${table(
        'Orbital mesh · 6 active nodes',
        ['Node', 'Plane', 'Load', 'Status'],
        SATELLITES.filter((satellite) => satellite.telemetry).map(
          (satellite) =>
            `<tr><td class="mono-cell">${esc(satellite.id)}</td><td class="mono-cell">${esc(
              satellite.plane,
            )}</td><td class="mono-cell">${satellite.utilization}%</td><td><span class="status-pill${
              satellite.status === 'Nominal' ? '' : ' status-pill--warn'
            }">${esc(satellite.status)}</span></td></tr>`,
        ),
      )}</div>`;
    case 'brand-kit':
      return `<div class="brand-kit"><div class="brand-kit__mark" aria-hidden="true">AETHER</div><div class="brand-kit__swatches">
        <div><span style="background:#f2f0e9"></span><strong>Paper</strong><code>#F2F0E9</code></div>
        <div><span style="background:#13171a"></span><strong>Ink</strong><code>#13171A</code></div>
        <div><span style="background:#ee5a24"></span><strong>Safety orange</strong><code>#EE5A24</code></div>
        <div><span style="background:#101417"></span><strong>Flight dark</strong><code>#101417</code></div>
      </div><p class="widget-note">The orbital mark is used intact. Safety orange is reserved for action and key data.</p></div>`;
    case 'launch-manifest':
      return table(
        'Launch manifest · 24 nodes',
        ['Node', 'Plane', 'Launch', 'State'],
        SATELLITES.map(
          (satellite) =>
            `<tr><td class="mono-cell">${esc(satellite.id)}</td><td class="mono-cell">${esc(
              satellite.plane,
            )}</td><td class="mono-cell">${esc(satellite.launch)}</td><td><span class="status-pill${
              satellite.telemetry ? '' : ' status-pill--warn'
            }">${satellite.telemetry ? 'On orbit' : esc(satellite.status)}</span></td></tr>`,
        ),
      );
    case 'orbit-calculator':
      return orbitCalculator();
    case 'residency-table':
      return table(
        'Residency boundaries',
        ['Boundary', 'Station', 'Routing', 'Status'],
        RESIDENCY_ROWS.map(
          (row) =>
            `<tr><td>${esc(row.boundary)}</td><td>${esc(row.station)}</td><td>${esc(
              row.routing,
            )}</td><td><span class="status-pill${
              row.status === 'Dedicated only' ? ' status-pill--warn' : ''
            }">${esc(row.status)}</span></td></tr>`,
        ),
      );
    case 'incident-history':
      return `<ol class="incident-list">${INCIDENTS.map(
        (incident) =>
          `<li><div class="incident-list__meta"><span>${esc(
            incident.date,
          )}</span><span>${esc(incident.status)}</span></div><h3>${esc(
            incident.title,
          )}</h3><p>${esc(incident.impact)}</p></li>`,
      ).join('')}</ol>`;
    case 'model-compare':
      return table(
        'Model catalog',
        ['Model', 'Family', 'Context', 'Input', 'Output'],
        MODELS.map(
          (model) =>
            `<tr><th scope="row">${esc(model.name)}</th><td>${esc(model.family)}</td><td class="mono-cell">${esc(
              model.context,
            )}</td><td class="mono-cell">${esc(model.input)}</td><td class="mono-cell">${esc(
              model.output,
            )}</td></tr>`,
        ),
      );
    case 'model-benchmarks':
      return `<div class="benchmark-table">${MODELS.map(
        (model) =>
          `<article class="benchmark-row"><div class="benchmark-row__head"><h3>${esc(
            model.name,
          )}</h3><span>${esc(model.family)}</span></div><div class="benchmark-row__bars">${model.benchmarks
            .map(
              (benchmark) =>
                `<div class="benchmark"><span class="benchmark__label">${esc(
                  benchmark.label,
                )}</span><span class="benchmark__track" aria-hidden="true"><span class="benchmark__bar" style="width:${
                  (benchmark.value / benchmark.max) * 100
                }%"></span></span><span class="benchmark__value">${benchmark.value}</span></div>`,
            )
            .join('')}</div></article>`,
      ).join('')}</div>`;
    case 'model-deprecated': {
      const rows = [
        { alias: 'aether-70b', replacement: 'aether-70b-instruct', retired: '2026-12-31' },
        { alias: 'aether-8x22b-v1', replacement: 'aether-8x22b', retired: '2026-11-15' },
        { alias: 'aether-embed-1024', replacement: 'aether-embed', retired: '2027-01-31' },
        { alias: 'aether-mini-v0', replacement: 'aether-mini', retired: '2026-10-01' },
      ];
      return table(
        'Deprecated aliases',
        ['Alias', 'Replacement', 'Retires'],
        rows.map(
          (row) =>
            `<tr><td class="mono-cell">${esc(row.alias)}</td><td class="mono-cell">${esc(
              row.replacement,
            )}</td><td class="mono-cell">${esc(row.retired)}</td></tr>`,
        ),
      );
    }
    case 'constellation-map':
      return `<div class="widget-stack">${constellationDiagram()}${metrics(NETWORK_METRICS)}</div>`;
    case 'station-table':
      return table(
        'Ground segment · 8 stations',
        ['Station', 'Code', 'Metro', 'p50', 'Status'],
        STATIONS.map(
          (station) =>
            `<tr><td><a class="table-link" href="/network/ground-stations/${esc(
              station.slug,
            )}">${esc(station.name)}</a><span class="table-secondary">${esc(
              station.location,
            )}</span></td><td class="mono-cell">${esc(station.code)}</td><td>${esc(
              station.metro,
            )}</td><td class="mono-cell">${station.latency} ms</td><td><span class="status-pill">Operational</span></td></tr>`,
        ),
      );
    case 'latency-chart':
      return `<div class="widget-stack">${latencyChart(LATENCY_ROUTES)}<p class="source-note">Modeled p50, including 4 ms of ground processing. Terrestrial figures are public fiber-route estimates.</p></div>`;
    case 'handoff-steps':
      return processSteps(HANDOFF_STEPS);
    case 'telemetry-table':
      return table(
        'Illustrative snapshot · 2026-10-25 04:12 UTC',
        ['Node', 'Plane', 'Status', 'Node load', 'Radiator', 'Optical link'],
        SATELLITES.filter((satellite) => satellite.telemetry).map(
          (satellite) =>
            `<tr><td class="mono-cell"><a class="table-link" href="/network/satellites/${esc(
              satellite.slug,
            )}">${esc(satellite.id)}</a></td><td class="mono-cell">${esc(
              satellite.plane,
            )}</td><td><span class="status-pill${
              satellite.status === 'Nominal' ? '' : ' status-pill--warn'
            }">${esc(satellite.status)}</span></td><td><span class="util"><span class="util__track" aria-hidden="true"><span class="util__bar" style="width:${
              satellite.utilization
            }%"></span></span><span class="util__value">${satellite.utilization}%</span></span></td><td class="mono-cell">${esc(
              satellite.radiator,
            )}</td><td class="mono-cell">${esc(satellite.link)}</td></tr>`,
        ),
      );
    default:
      return '';
  }
}

export { accordion, pricingCalculator };
