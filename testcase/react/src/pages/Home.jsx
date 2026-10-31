import {
  CodeBlock,
  CTASection,
  LatencyChart,
  Metrics,
  OrbitDiagram,
  SectionHead,
} from '../components/index.js';
import {
  CUSTOMER_LOGOS,
  HOME_METRICS,
  LATENCY_ROUTES,
  ORBIT_FEATURES,
  SECTION_IDS,
} from '../content/site.js';
import { Link } from '../router.jsx';

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
  {
    title: 'API',
    copy: 'One OpenAI-compatible endpoint. No new SDK, no new mental model.',
  },
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
 */
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="shell hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="eyebrow__index">01</span>
              Orbital inference network
            </p>
            <h1 className="hero__title">
              Put your models
              <br />
              <span className="hero__title-accent">in orbit.</span>
            </h1>
            <p className="lede hero__lede">
              Aether operates radiation-hardened GPU nodes 550 kilometres above the ground and
              serves LLM inference over an optical mesh. Lower latency where fiber is slow. No land,
              no water, no interconnection queue.
            </p>
            <div className="hero__actions">
              <Link to={`/company#${SECTION_IDS.contact}`} className="button button--orange">
                Request capacity <span aria-hidden="true">↗</span>
              </Link>
              <Link to="/platform" className="button button--ghost">
                See the architecture <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="hero__note">
              <span className="status-dot" aria-hidden="true" />
              Now serving · 6 satellites · 8 ground stations
            </p>
          </div>

          <div className="hero__visual">
            <OrbitDiagram />
          </div>
        </div>

        <div className="shell">
          <Metrics items={HOME_METRICS} />
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="02"
            label="Why orbit"
            title={
              <>
                Land is the wrong
                <br />
                constraint.
              </>
            }
            lede="Terrestrial datacenters compete for power, water, and permits. Orbit has all three in surplus."
          />

          <div className="feature-grid">
            {ORBIT_FEATURES.map((feature) => (
              <article className="feature" key={feature.index}>
                <span className="feature__index">{feature.index}</span>
                <h3 className="feature__title">{feature.title}</h3>
                <p className="feature__copy">{feature.copy}</p>
                <div className="feature__data">
                  <span>Reference</span>
                  <span>{feature.data}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="shell">
          <SectionHead
            index="03"
            label="Architecture"
            title={
              <>
                From vacuum
                <br />
                to your API.
              </>
            }
            lede="Five hops. One endpoint. The physics is ours; the interface is boring on purpose."
          />

          <div className="arch">
            <ol className="arch__steps">
              {ARCH_STEPS.map((step, index) => (
                <li className="arch__step" key={step.title}>
                  <span className="arch__index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="arch__code">
              <CodeBlock
                label="request.sh"
                code={CURL_EXAMPLE}
                note="The base URL resolves to the ground relay nearest your region. No client changes."
              />
              <div className="chip-row">
                <span className="chip">OpenAI-compatible</span>
                <span className="chip">Streaming</span>
                <span className="chip">128k context</span>
                <span className="chip">JSON schema</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="04"
            label="Latency"
            title={
              <>
                The short way
                <br />
                is through the sky.
              </>
            }
            lede="Light in vacuum travels about 47% faster than light in fiber. At 550 kilometres, the detour is worth it."
          />

          <div className="latency-layout">
            <LatencyChart routes={LATENCY_ROUTES.slice(0, 4)} />

            <aside className="latency-aside">
              <p className="mono-label">Physics, not marketing</p>
              <p>
                A request travels from your VPC to the nearest ground station, up to the node, and
                back down the shortest optical path. Most of the gain comes from skipping the
                terrestrial detours that fiber has to follow.
              </p>
              <dl className="mini-specs">
                <div>
                  <dt>Speed in vacuum</dt>
                  <dd>300 km/ms</dd>
                </div>
                <div>
                  <dt>Node altitude</dt>
                  <dd>550 km</dd>
                </div>
                <div>
                  <dt>Ground processing</dt>
                  <dd>4 ms</dd>
                </div>
              </dl>
              <Link to="/network" className="text-link">
                See the full network <span aria-hidden="true">→</span>
              </Link>
            </aside>
          </div>

          <p className="source-note">
            Modeled p50, including 4 ms of ground processing. Terrestrial figures are public
            fiber-route estimates.
          </p>
        </div>
      </section>

      <section className="section section--dark">
        <div className="shell">
          <div className="quote-layout">
            <div className="quote__intro">
              <p className="eyebrow">
                <span className="eyebrow__index">05</span>
                Operators
              </p>
              <span className="quote__mark" aria-hidden="true">
                “
              </span>
            </div>

            <div>
              <blockquote className="quote__text">
                We moved our latency-critical inference to Aether and cut p50 response time by 38%.
                The orbital handoffs are invisible to our users.
              </blockquote>
              <div className="quote__author">
                <strong>Dr. Maya Chen</strong>
                <span>VP Infrastructure, Meridian AI</span>
              </div>

              <div className="logo-row">
                {CUSTOMER_LOGOS.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
