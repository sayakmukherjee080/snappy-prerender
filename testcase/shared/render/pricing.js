import { COMPARISON_ROWS, PLANS, PRICING_FAQS, RESERVED_DISCOUNT } from '../content/pricing.js';
import { SECTION_IDS } from '../content/site.js';
import { formatDollars } from '../lib/format.js';
import { ctaSection, link, pageHero, sectionHead } from './base.js';
import { accordion, pricingCalculator } from './widgets.js';

/**
 * Renders one pricing tier with data hooks for the billing toggle.
 * @param {object} plan
 * @returns {string}
 */
function planCard(plan) {
  const ctaTo =
    plan.id === 'developer' ? `/platform#${SECTION_IDS.api}` : `/company#${SECTION_IDS.contact}`;
  const hasPlatform = plan.platform !== null;
  const platform = hasPlatform ? plan.platform : null;
  const input = plan.input;
  const output = plan.output;

  return `<article class="plan${plan.featured ? ' plan--featured' : ''}" data-plan="${plan.id}">
  ${plan.featured ? '<span class="plan__badge">Most deployed</span>' : ''}
  <div class="plan__head"><h2>${plan.name}</h2><p>${plan.tagline}</p></div>
  <div class="plan__price"><span data-plan-price>${
    platform === null ? plan.priceLabel : formatDollars(platform)
  }</span><span>${plan.priceSuffix}</span></div>
  <div class="plan__rates" data-plan-rates data-platform="${hasPlatform ? platform : ''}" data-input="${
    input ?? ''
  }" data-output="${output ?? ''}">
    ${
      input === null
        ? '<span>Custom token rates</span>'
        : `<span data-rate="input">$${input.toFixed(2)} / 1M input</span><span data-rate="output">$${output.toFixed(
            2,
          )} / 1M output</span>`
    }
  </div>
  <ul class="plan__features">${plan.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
  ${link(ctaTo, `${plan.cta} <span aria-hidden="true">→</span>`, {
    className: `button${plan.featured ? ' button--orange' : ' button--ghost'} plan__cta`,
  })}
  <p class="plan__note" hidden data-plan-note>Annual commit · rates shown include the 20% discount</p>
</article>`;
}

/**
 * Renders pricing tiers, a usage estimator, the comparison table, and billing questions.
 * @returns {string}
 */
export function pricingPage() {
  return `${pageHero({
    index: '04',
    label: 'Pricing',
    title: 'Capacity by<br />the token.',
    lede: 'Start on shared nodes with no commitment. Move to reserved capacity when latency and isolation stop being optional.',
    meta: [
      { label: 'Billing', value: 'Per token' },
      { label: 'Egress', value: 'Included' },
      { label: 'Currency', value: 'USD' },
    ],
  })}

<section class="section"><div class="shell">
  <div class="pricing-head">
    ${sectionHead({
      index: '01',
      label: 'Plans',
      title: 'Pick your<br />altitude.',
      lede: 'Every plan uses the same orbital network and the same API. What changes is routing priority, isolation, and the size of the commit.',
    })}
    <fieldset class="pricing-toggle" aria-label="Billing period" data-island="pricing-toggle">
      <button type="button" data-reserved-option="false" aria-pressed="true">On-demand</button>
      <button type="button" data-reserved-option="true" aria-pressed="false">Reserved · save 20%</button>
    </fieldset>
  </div>
  <div class="pricing-grid" data-pricing-grid>${PLANS.map(planCard).join('')}</div>
  <p class="source-note">Rates are per million tokens. Reserved pricing requires a twelve-month commit. Dedicated capacity is quoted per mission.</p>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '02',
    label: 'Estimator',
    title: 'Estimate<br />your orbit.',
    lede: 'Set a monthly token volume to see where each plan lands. The mix is fixed at 70% input and 30% output.',
  })}
  ${pricingCalculator(false, false)}
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '03',
    label: 'Compare',
    title: 'The details,<br />side by side.',
    lede: 'List rates shown below are on-demand. Reserved rates are 20% lower on usage and platform fees.',
  })}
  <div class="table-wrap"><table class="data-table">
    <caption>Plan comparison</caption>
    <thead><tr><th scope="col">Feature</th><th scope="col">Developer</th><th scope="col">Scale</th><th scope="col">Dedicated</th></tr></thead>
    <tbody>${COMPARISON_ROWS.map(
      (row) =>
        `<tr><th scope="row">${row.label}</th><td>${row.developer}</td><td>${row.scale}</td><td>${row.dedicated}</td></tr>`,
    ).join('')}</tbody>
  </table></div>
</div></section>

<section class="section"><div class="shell">
  <div class="faq-layout">
    <div><p class="eyebrow"><span class="eyebrow__index">04</span>Billing</p><h2 class="faq-layout__title">Before you commit.</h2></div>
    ${accordion(PRICING_FAQS)}
  </div>
</div></section>

${ctaSection(
  'Hold a slot on the next launch.',
  'Capacity is allocated per plane and per launch window. Tell us the region and volume; we will return a route and a date.',
)}`;
}

export { RESERVED_DISCOUNT };
