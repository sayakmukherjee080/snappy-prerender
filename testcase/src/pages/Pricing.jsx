import { useId, useState } from 'react';
import { Accordion, CTASection, PageHero, SectionHead } from '../components/index.js';
import {
  COMPARISON_ROWS,
  MAX_VOLUME,
  MIN_VOLUME,
  PLANS,
  PRICING_FAQS,
  RESERVED_DISCOUNT,
} from '../content/pricing.js';
import { SECTION_IDS } from '../content/site.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { estimateMonthlyCost } from '../lib/estimate.js';
import { Link } from '../router.jsx';

const dollarFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Formats a whole-dollar amount with a leading dollar sign.
 * @param {number} value
 * @returns {string}
 */
function formatDollars(value) {
  return `$${dollarFormat.format(Math.round(value))}`;
}

/**
 * Renders one pricing tier with rates adjusted for the selected billing period.
 * @param {{ plan: (typeof PLANS)[number], reserved: boolean }} props
 */
function PlanCard({ plan, reserved }) {
  const multiplier = reserved ? 1 - RESERVED_DISCOUNT : 1;
  const platform = plan.platform === null ? null : plan.platform * multiplier;
  const input = plan.input === null ? null : plan.input * multiplier;
  const output = plan.output === null ? null : plan.output * multiplier;
  const ctaTo =
    plan.id === 'developer' ? `/platform#${SECTION_IDS.api}` : `/company#${SECTION_IDS.contact}`;

  return (
    <article className={`plan${plan.featured ? ' plan--featured' : ''}`}>
      {plan.featured && <span className="plan__badge">Most deployed</span>}

      <div className="plan__head">
        <h2>{plan.name}</h2>
        <p>{plan.tagline}</p>
      </div>

      <div className="plan__price">
        {platform === null ? plan.priceLabel : formatDollars(platform)}
        <span>{plan.priceSuffix}</span>
      </div>

      <div className="plan__rates">
        {input === null ? (
          <span>Custom token rates</span>
        ) : (
          <>
            <span>{`$${input.toFixed(2)}`} / 1M input</span>
            <span>{`$${output.toFixed(2)}`} / 1M output</span>
          </>
        )}
      </div>

      <ul className="plan__features">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <Link
        to={ctaTo}
        className={`button${plan.featured ? ' button--orange' : ' button--ghost'} plan__cta`}
      >
        {plan.cta} <span aria-hidden="true">→</span>
      </Link>
      {reserved && plan.id !== 'dedicated' && (
        <p className="plan__note">Annual commit · rates shown include the 20% discount</p>
      )}
    </article>
  );
}

/**
 * Renders pricing tiers, a usage estimator, the comparison table, and billing questions.
 */
export default function Pricing() {
  const [reserved, setReserved] = useState(false);
  const [volume, setVolume] = useState(50);
  const generatedId = useId();
  const sliderId = `token-volume-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  usePageMeta({
    title: 'Pricing',
    description:
      'Aether Compute pricing: usage-based orbital inference from $0.85 per million input tokens, reserved capacity, and dedicated nodes.',
  });

  const {
    developer: developerEstimate,
    scale: scaleEstimate,
    recommendation,
  } = estimateMonthlyCost(volume, reserved);

  return (
    <>
      <PageHero
        index="04"
        label="Pricing"
        title={
          <>
            Capacity by
            <br />
            the token.
          </>
        }
        lede="Start on shared nodes with no commitment. Move to reserved capacity when latency and isolation stop being optional."
        meta={[
          { label: 'Billing', value: 'Per token' },
          { label: 'Egress', value: 'Included' },
          { label: 'Currency', value: 'USD' },
        ]}
      />

      <section className="section">
        <div className="shell">
          <div className="pricing-head">
            <SectionHead
              index="01"
              label="Plans"
              title={
                <>
                  Pick your
                  <br />
                  altitude.
                </>
              }
              lede="Every plan uses the same orbital network and the same API. What changes is routing priority, isolation, and the size of the commit."
            />

            <fieldset className="pricing-toggle" aria-label="Billing period">
              <button type="button" aria-pressed={!reserved} onClick={() => setReserved(false)}>
                On-demand
              </button>
              <button type="button" aria-pressed={reserved} onClick={() => setReserved(true)}>
                Reserved · save 20%
              </button>
            </fieldset>
          </div>

          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} reserved={reserved} />
            ))}
          </div>

          <p className="source-note">
            Rates are per million tokens. Reserved pricing requires a twelve-month commit. Dedicated
            capacity is quoted per mission.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="02"
            label="Estimator"
            title={
              <>
                Estimate
                <br />
                your orbit.
              </>
            }
            lede="Set a monthly token volume to see where each plan lands. The mix is fixed at 70% input and 30% output."
          />

          <div className="calculator">
            <div className="calculator__controls">
              <label className="mono-label" htmlFor={sliderId}>
                Monthly tokens
              </label>
              <div className="calculator__value">
                {volume}
                <span>M</span>
              </div>
              <input
                id={sliderId}
                type="range"
                min={MIN_VOLUME}
                max={MAX_VOLUME}
                step="1"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <div className="calculator__scale">
                <span>1M</span>
                <span>500M</span>
              </div>
              <p className="calculator__assumption">
                {reserved ? 'Reserved rates applied.' : 'On-demand rates applied.'} Input and output
                are metered separately; the estimator uses a 70/30 mix.
              </p>
            </div>

            <div className="calculator__output">
              <p className="mono-label">Estimated monthly</p>
              <div className="calculator__row">
                <span>Developer</span>
                <strong>{formatDollars(developerEstimate)}</strong>
              </div>
              <div className="calculator__row">
                <span>Scale</span>
                <strong>{formatDollars(scaleEstimate)}</strong>
              </div>
              <div className="calculator__row">
                <span>Dedicated</span>
                <strong>Custom</strong>
              </div>
              <p className="calculator__recommendation">
                Best fit <strong>{recommendation}</strong>
              </p>
              <p className="calculator__note">
                Estimates exclude taxes. A dedicated node starts at $180,000 per month.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="03"
            label="Compare"
            title={
              <>
                The details,
                <br />
                side by side.
              </>
            }
            lede="List rates shown below are on-demand. Reserved rates are 20% lower on usage and platform fees."
          />

          <div className="table-wrap">
            <table className="data-table">
              <caption>Plan comparison</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Developer</th>
                  <th scope="col">Scale</th>
                  <th scope="col">Dedicated</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.developer}</td>
                    <td>{row.scale}</td>
                    <td>{row.dedicated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="faq-layout">
            <div>
              <p className="eyebrow">
                <span className="eyebrow__index">04</span>
                Billing
              </p>
              <h2 className="faq-layout__title">Before you commit.</h2>
            </div>
            <Accordion items={PRICING_FAQS} />
          </div>
        </div>
      </section>

      <CTASection
        title="Hold a slot on the next launch."
        copy="Capacity is allocated per plane and per launch window. Tell us the region and volume; we will return a route and a date."
      />
    </>
  );
}
