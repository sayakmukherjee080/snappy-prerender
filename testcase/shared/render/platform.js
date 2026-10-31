import { SECTION_IDS } from '../content/site.js';
import { codeBlock, ctaSection, pageHero, processSteps, sectionHead } from './base.js';
import { accordion } from './widgets.js';

const NODE_SPECS = [
  { label: 'Compute', value: '8 × tensor accelerators', note: '1.2 PFLOPS FP8 · 192 GB HBM3e' },
  { label: 'Power', value: '42 kW solar', note: 'GaAs arrays · 18 kWh buffer' },
  { label: 'Thermal', value: '38 kW rejection', note: 'Deployable ammonia loop' },
  { label: 'Radiation', value: '300 krad tolerant', note: 'ECC memory · scrubbed flash' },
  { label: 'Uplink', value: '20 Gbps optical', note: '2 × 10 Gbps terminals' },
  { label: 'Mass', value: '1,840 kg', note: 'Medium-lift rideshare class' },
];

const INFERENCE_STEPS = [
  {
    title: 'Prefill',
    copy: 'The prompt lands on the node with the shortest path from your ground station. The KV cache is built in HBM, not shuffled to disk.',
  },
  {
    title: 'Decode',
    copy: 'Tokens stream back over laser while the node tracks the horizon. Speculative decoding hides the round trip.',
  },
  {
    title: 'Handoff',
    copy: 'Ninety seconds before loss of signal, state is mirrored to the next satellite. Your stream does not notice.',
  },
];

const API_EXAMPLE = String.raw`curl https://orbit.aethercompute.space/v1/chat/completions \
  -H "Authorization: Bearer $AETHER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aether-70b-instruct",
    "messages": [
      { "role": "system", "content": "You are a flight controller." },
      { "role": "user", "content": "Draft the pass plan." }
    ],
    "stream": true
  }'`;

const RELIABILITY = [
  {
    title: 'Handoff before loss of signal',
    copy: 'Session state is mirrored at T−90 seconds. The next node picks up the same request ID and token stream.',
    data: '90 s lead time',
  },
  {
    title: 'Three paths to every metro',
    copy: 'No single ground-station failure removes a city from the network. Traffic re-routes over the optical mesh.',
    data: 'N+2 ground paths',
  },
  {
    title: 'Store-and-forward during eclipse',
    copy: 'Requests queue in orbit and drain on the next pass. No silent drops, no duplicate billing.',
    data: '0 dropped tokens',
  },
  {
    title: '99.98% measured availability',
    copy: 'Year-to-date across all commercial routes, including scheduled handoffs and two planned ground-station outages.',
    data: '2026 YTD',
  },
];

const SECURITY_CONTROLS = [
  'Signed boot chain from the ground segment to every node.',
  'Per-request memory isolation; HBM is zeroed between batches.',
  'Customer keys stay in ground HSMs; satellites hold session keys only.',
  'No prompt or output persistence in orbit.',
  'Annual independent penetration test and flight-software review.',
];

const PLATFORM_FAQS = [
  {
    question: 'Can I run training workloads?',
    answer:
      'No. The nodes are sized and shielded for inference: high memory bandwidth, low duty cycle, and tight thermal limits. Training stays on the ground; checkpoints are uploaded once and loaded per tenant.',
  },
  {
    question: 'What models are available?',
    answer:
      'Aether-hosted open-weight models, plus private fine-tunes. Private weights are encrypted at rest on the ground, verified in the clean room, and loaded onto the node before your traffic is routed.',
  },
  {
    question: 'What happens during a launch failure?',
    answer:
      'Committed capacity is spread across launch windows and orbital planes. A lost launch shifts the schedule, not your reservation. Service credits apply if committed capacity is unavailable.',
  },
  {
    question: 'Is there a minimum commit?',
    answer:
      'Developer is usage-only with no commitment. Scale starts at $2,400 per month. Dedicated nodes and private ground segments start at twelve months.',
  },
  {
    question: 'How do weights get to orbit?',
    answer:
      'They do not travel with your request. Weights are uploaded once, validated on the ground, and preloaded onto the node. Prompts go up; model weights stay put.',
  },
];

/**
 * Renders the hardware, inference path, API, reliability, security, and deployment details.
 * @returns {string}
 */
export function platformPage() {
  return `${pageHero({
    index: '02',
    label: 'Platform',
    title: 'A rack that<br />survives the launch.',
    lede: 'Every Aether node is a complete inference appliance: eight accelerators, 192 GB of HBM, 42 kW of deployable solar, and a thermal loop sized for the vacuum.',
    meta: [
      { label: 'Orbit', value: '550 km SSO' },
      { label: 'Compute', value: '1.2 PFLOPS FP8' },
      { label: 'Power', value: '42 kW solar' },
    ],
  })}

<section class="section"><div class="shell">
  ${sectionHead({
    index: '01',
    label: 'The node',
    title: 'Flight hardware,<br />inference software.',
    lede: 'One node is a satellite. Twenty-four nodes are a datacenter. Both are designed to be replaced, not repaired.',
  })}
  <div class="spec-grid">${NODE_SPECS.map(
    (spec) =>
      `<article class="spec"><span class="spec__label">${spec.label}</span><span class="spec__value">${spec.value}</span><span class="spec__note">${spec.note}</span></article>`,
  ).join('')}</div>
  <p class="source-note">Flight units are derated from ground qualification limits. Figures describe the current Aether-2 block.</p>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '02',
    label: 'Inference path',
    title: 'Prefill, decode,<br />hand off.',
    lede: 'The model does not know it is moving. The scheduler does.',
  })}
  <div class="process-layout">
    ${processSteps(INFERENCE_STEPS)}
    <aside class="process-aside">
      <p class="mono-label">Per-request budget</p>
      <div class="process-aside__row"><span>Handoff lead</span><strong>90 s</strong></div>
      <div class="process-aside__row"><span>Ground processing</span><strong>4 ms</strong></div>
      <div class="process-aside__row"><span>Dropped tokens</span><strong>0</strong></div>
      <p class="process-aside__note">Handoffs are scheduled from orbit determination, not triggered by packet loss.</p>
    </aside>
  </div>
</div></section>

<section class="section section--dark" id="${SECTION_IDS.api}"><div class="shell">
  ${sectionHead({
    index: '03',
    label: 'Inference API',
    title: 'The endpoint is<br />boring on purpose.',
    lede: 'Keep your SDK. Point it at orbit.aethercompute.space and keep shipping.',
  })}
  <div class="api-layout">
    ${codeBlock('request.sh', API_EXAMPLE, 'Chat completions, streaming, tools, and structured outputs share the same request shape as your current provider.')}
    <div class="api-aside">
      <p class="mono-label">Base URL</p>
      <p class="endpoint">https://orbit.aethercompute.space/v1</p>
      <ul class="check-list"><li>Chat completions and streaming</li><li>Tool calling and JSON schema</li><li>Embeddings and reranking</li><li>128k context · 8k output</li><li>Per-request usage metadata</li></ul>
      <p class="api-aside__note">Regional routing is automatic. Send the <code>X-Aether-Region</code> header to pin a ground segment.</p>
    </div>
  </div>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '04',
    label: 'Reliability',
    title: 'Designed for<br />the horizon.',
    lede: 'The horizon is a scheduled event. Everything else is redundancy.',
  })}
  <div class="tile-grid">${RELIABILITY.map(
    (item) =>
      `<article class="tile"><span class="tile__data">${item.data}</span><h3>${item.title}</h3><p>${item.copy}</p></article>`,
  ).join('')}</div>
</div></section>

<section class="section section--dark" id="${SECTION_IDS.security}"><div class="shell">
  ${sectionHead({
    index: '05',
    label: 'Security',
    title: 'Your prompts are<br />guests, not residents.',
    lede: 'Orbit is a hostile environment for data retention. We treat that as a feature.',
  })}
  <div class="security-layout">
    <ul class="security-list">${SECURITY_CONTROLS.map((control) => `<li>${control}</li>`).join('')}</ul>
    <aside class="security-panel">
      <p class="mono-label">Data path</p>
      <ol><li><span>01</span> Your VPC to private ground relay</li><li><span>02</span> Relay to optical uplink · AES-256</li><li><span>03</span> Node to ephemeral HBM</li><li><span>04</span> Response returned, buffer discarded</li></ol>
      <div class="chip-row"><span class="chip chip--dark">AES-256</span><span class="chip chip--dark">TLS 1.3</span><span class="chip chip--dark">Zero retention</span></div>
      <p class="security-panel__note">Designed to SOC 2 controls. Audit report available under NDA.</p>
    </aside>
  </div>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '06',
    label: 'Deployment',
    title: 'Three ways<br />to orbit.',
    lede: 'Start shared. Move to a dedicated node when isolation stops being optional.',
  })}
  <div class="table-wrap"><table class="data-table">
    <caption>Deployment models</caption>
    <thead><tr><th scope="col">Mode</th><th scope="col">Isolation</th><th scope="col">Best for</th><th scope="col">Commit</th></tr></thead>
    <tbody>
      <tr><td>Shared</td><td>Per-request memory isolation</td><td>Teams shipping fast</td><td>None</td></tr>
      <tr><td>Dedicated</td><td>Whole node · private KV cache</td><td>Regulated workloads</td><td>12 months</td></tr>
      <tr><td>Sovereign</td><td>Whole satellite · private ground segment</td><td>Governments and defense</td><td>24 months</td></tr>
    </tbody>
  </table></div>
  <div class="faq-layout">
    <div><p class="eyebrow"><span class="eyebrow__index">07</span>Questions</p><h2 class="faq-layout__title">From mission control.</h2></div>
    ${accordion(PLATFORM_FAQS)}
  </div>
</div></section>

${ctaSection()}`;
}
