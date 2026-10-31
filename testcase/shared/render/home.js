import {
  CUSTOMER_LOGOS,
  HOME_METRICS,
  LATENCY_ROUTES,
  ORBIT_FEATURES,
  SECTION_IDS,
} from '../content/site.js';
import { codeBlock, ctaSection, latencyChart, link, metrics, sectionHead } from './base.js';
import { orbitDiagram } from './diagrams.js';

const ARCH_STEPS = [
  {
    title: 'Launch',
    copy: 'Nodes ride to 550 km on rideshare missions, then unfold 42 kW of solar array.',
  },
  {
    title: 'Orbit',
    copy: 'Sun-synchronous planes keep radiators cold and power predictable through every pass.',
  },
  {
    title: 'Mesh',
    copy: 'Optical crosslinks route tokens between satellites without touching the ground.',
  },
  {
    title: 'Relay',
    copy: 'Eight ground stations hand traffic to terrestrial fiber at the nearest metro.',
  },
  { title: 'API', copy: 'One OpenAI-compatible endpoint. No new SDK, no new mental model.' },
];

const CURL_EXAMPLE = String.raw`curl https://orbit.aethercompute.space/v1/chat/completions \
  -H "Authorization: Bearer $AETHER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aether-70b-instruct",
    "messages": [
      { "role": "user", "content": "Summarise this telemetry." }
    ],
    "stream": true
  }'`;

/**
 * Renders the mission, architecture, latency, and operator story for the orbital network.
 * @returns {string}
 */
export function homePage() {
  return `<section class="hero">
  <div class="shell hero__grid">
    <div class="hero__copy">
      <p class="eyebrow"><span class="eyebrow__index">01</span>Orbital inference network</p>
      <h1 class="hero__title">Put your models<br /><span class="hero__title-accent">in orbit.</span></h1>
      <p class="lede hero__lede">Aether operates radiation-hardened GPU nodes 550 kilometres above the ground and serves LLM inference over an optical mesh. Lower latency where fiber is slow. No land, no water, no interconnection queue.</p>
      <div class="hero__actions">
        ${link(
          `/company#${SECTION_IDS.contact}`,
          'Request capacity <span aria-hidden="true">↗</span>',
          {
            className: 'button button--orange',
          },
        )}
        ${link('/platform', 'See the architecture <span aria-hidden="true">→</span>', {
          className: 'button button--ghost',
        })}
      </div>
      <p class="hero__note"><span class="status-dot" aria-hidden="true"></span>Now serving · 6 satellites · 8 ground stations</p>
    </div>
    <div class="hero__visual">${orbitDiagram()}</div>
  </div>
  <div class="shell">${metrics(HOME_METRICS)}</div>
</section>

<section class="section">
  <div class="shell">
    ${sectionHead({
      index: '02',
      label: 'Why orbit',
      title: 'Land is the wrong<br />constraint.',
      lede: 'Terrestrial datacenters compete for power, water, and permits. Orbit has all three in surplus.',
    })}
    <div class="feature-grid">${ORBIT_FEATURES.map(
      (feature) => `<article class="feature">
      <span class="feature__index">${feature.index}</span>
      <h3 class="feature__title">${feature.title}</h3>
      <p class="feature__copy">${feature.copy}</p>
      <div class="feature__data"><span>Reference</span><span>${feature.data}</span></div>
    </article>`,
    ).join('')}</div>
  </div>
</section>

<section class="section section--dark">
  <div class="shell">
    ${sectionHead({
      index: '03',
      label: 'Architecture',
      title: 'From vacuum<br />to your API.',
      lede: 'Five hops. One endpoint. The physics is ours; the interface is boring on purpose.',
    })}
    <div class="arch">
      <ol class="arch__steps">${ARCH_STEPS.map(
        (step, index) =>
          `<li class="arch__step"><span class="arch__index">${String(index + 1).padStart(
            2,
            '0',
          )}</span><div><h3>${step.title}</h3><p>${step.copy}</p></div></li>`,
      ).join('')}</ol>
      <div class="arch__code">
        ${codeBlock('request.sh', CURL_EXAMPLE, 'The base URL resolves to the ground relay nearest your region. No client changes.')}
        <div class="chip-row"><span class="chip">OpenAI-compatible</span><span class="chip">Streaming</span><span class="chip">128k context</span><span class="chip">JSON schema</span></div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="shell">
    ${sectionHead({
      index: '04',
      label: 'Latency',
      title: 'The short way<br />is through the sky.',
      lede: 'Light in vacuum travels about 47% faster than light in fiber. At 550 kilometres, the detour is worth it.',
    })}
    <div class="latency-layout">
      ${latencyChart(LATENCY_ROUTES.slice(0, 4))}
      <aside class="latency-aside">
        <p class="mono-label">Physics, not marketing</p>
        <p>A request travels from your VPC to the nearest ground station, up to the node, and back down the shortest optical path. Most of the gain comes from skipping the terrestrial detours that fiber has to follow.</p>
        <dl class="mini-specs"><div><dt>Speed in vacuum</dt><dd>300 km/ms</dd></div><div><dt>Node altitude</dt><dd>550 km</dd></div><div><dt>Ground processing</dt><dd>4 ms</dd></div></dl>
        ${link('/network', 'See the full network <span aria-hidden="true">→</span>', { className: 'text-link' })}
      </aside>
    </div>
    <p class="source-note">Modeled p50, including 4 ms of ground processing. Terrestrial figures are public fiber-route estimates.</p>
  </div>
</section>

<section class="section section--dark">
  <div class="shell">
    <div class="quote-layout">
      <div class="quote__intro"><p class="eyebrow"><span class="eyebrow__index">05</span>Operators</p><span class="quote__mark" aria-hidden="true">“</span></div>
      <div>
        <blockquote class="quote__text">We moved our latency-critical inference to Aether and cut p50 response time by 38%. The orbital handoffs are invisible to our users.</blockquote>
        <div class="quote__author"><strong>Dr. Maya Chen</strong><span>VP Infrastructure, Meridian AI</span></div>
        <div class="logo-row">${CUSTOMER_LOGOS.map((name) => `<span>${name}</span>`).join('')}</div>
      </div>
    </div>
  </div>
</section>

${ctaSection()}`;
}
