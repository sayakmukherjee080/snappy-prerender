export const PRICING_PAGES = [
  {
    slug: 'developer',
    title: 'Developer',
    eyebrow: 'Pricing / Developer',
    summary: 'Usage-only orbital inference for prototypes, evaluations, and low-volume production.',
    meta: [
      { label: 'Platform fee', value: '$0' },
      { label: 'Input', value: '$0.85 / 1M' },
      { label: 'Output', value: '$2.40 / 1M' },
    ],
    sections: [
      {
        title: 'No commitment',
        body: [
          'Developer has no platform fee and no minimum. You pay for input and output tokens, metered separately.',
          'Requests use shared nodes and the same orbital mesh as every other tier, with a 60 request-per-minute limit.',
        ],
        list: [
          'Shared orbital nodes',
          '32k context window',
          'Streaming and JSON schema',
          'Community support',
        ],
      },
    ],
    related: [
      { label: 'Scale', to: '/pricing/scale' },
      { label: 'Estimator', to: '/pricing/estimator' },
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
    ],
  },
  {
    slug: 'scale',
    title: 'Scale',
    eyebrow: 'Pricing / Scale',
    summary:
      'Priority routing, dedicated KV cache, and a 99.9% SLA for products where p50 is a feature.',
    meta: [
      { label: 'Platform', value: '$2,400 / mo' },
      { label: 'Input', value: '$0.68 / 1M' },
      { label: 'Output', value: '$1.92 / 1M' },
    ],
    sections: [
      {
        title: 'Built for production',
        body: [
          'Scale adds priority orbital routing, a dedicated KV cache, and a 128k context window. It is the default tier for products with real traffic.',
          'The plan includes a shared Slack channel with an inference engineer and a 99.9% uptime SLA.',
        ],
        list: [
          '600 requests per minute',
          'Priority orbital routing',
          'Dedicated KV cache',
          'Regional data residency',
        ],
      },
    ],
    related: [
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'Compare', to: '/pricing/compare' },
      { label: 'Reliability', to: '/platform/reliability' },
    ],
  },
  {
    slug: 'dedicated',
    title: 'Dedicated',
    eyebrow: 'Pricing / Dedicated',
    summary: 'A whole node or satellite, a private ground segment, and a named mission team.',
    meta: [
      { label: 'From', value: '$180k / mo' },
      { label: 'Commit', value: '12 months' },
      { label: 'SLA', value: '99.99%' },
    ],
    sections: [
      {
        title: 'Hardware-level isolation',
        body: [
          'Dedicated reserves the whole compute tray and KV cache. Sovereign deployments add a private ground segment and a dedicated orbital slot.',
          'Capacity is scheduled across launch windows and planes, so a launch delay shifts the schedule rather than the commitment.',
        ],
        list: [
          'Whole node or satellite',
          'Private ground segment',
          'Data residency controls',
          'Named mission team',
        ],
      },
    ],
    related: [
      { label: 'Deployments', to: '/platform/deployments' },
      { label: 'Security', to: '/platform/security' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'estimator',
    title: 'Orbit estimator',
    eyebrow: 'Pricing / Estimator',
    summary: 'Model a monthly token volume against Developer, Scale, and Dedicated capacity.',
    widget: 'pricing-calculator',
    sections: [
      {
        title: 'A useful approximation',
        body: [
          'The estimator assumes a 70/30 input-to-output token mix and applies the current on-demand or reserved rates. It excludes taxes and one-off mission work.',
        ],
      },
    ],
    related: [
      { label: 'Compare plans', to: '/pricing/compare' },
      { label: 'Developer', to: '/pricing/developer' },
      { label: 'Scale', to: '/pricing/scale' },
    ],
  },
  {
    slug: 'compare',
    title: 'Compare plans',
    eyebrow: 'Pricing / Compare',
    summary: 'Rate limits, context, isolation, support, and residency across the three tiers.',
    widget: 'pricing-compare',
    sections: [
      {
        title: 'Read the isolation column',
        body: [
          'The largest operational difference is not token price. It is whether the node, the KV cache, and the ground segment are shared.',
        ],
      },
    ],
    related: [
      { label: 'Estimator', to: '/pricing/estimator' },
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'SLA', to: '/legal/sla' },
    ],
  },
  {
    slug: 'enterprise',
    title: 'Enterprise',
    eyebrow: 'Pricing / Enterprise',
    summary:
      'Procurement, security review, regional routing, and a named team for large deployments.',
    meta: [
      { label: 'Review', value: 'Security package' },
      { label: 'Routing', value: 'Regional' },
      { label: 'Support', value: 'Named team' },
    ],
    sections: [
      {
        title: 'A procurement path that fits',
        body: [
          'Enterprise adds a security review package, custom DPA and SLA terms, regional routing controls, and a named mission team.',
          'We can stage a pilot on shared capacity while the dedicated node is being integrated.',
        ],
        list: [
          'Custom DPA and SLA',
          'Security review package',
          'Regional routing controls',
          'Pilot-to-dedicated path',
        ],
      },
    ],
    related: [
      { label: 'Trust center', to: '/legal/trust-center' },
      { label: 'DPA', to: '/legal/dpa' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'startups',
    title: 'Startups',
    eyebrow: 'Pricing / Startups',
    summary:
      'Credits, a lower Scale commitment, and engineering time for teams building their first orbital product.',
    meta: [
      { label: 'Credits', value: '$10k' },
      { label: 'Scale', value: '3-month minimum' },
      { label: 'Support', value: 'Office hours' },
    ],
    sections: [
      {
        title: 'Build the first version',
        body: [
          'Eligible startups receive $10,000 in usage credits, a three-month Scale commitment, and monthly office hours with an inference engineer.',
          'The pilot runs on the same network as production; there is no separate sandbox with different physics.',
        ],
        list: [
          '$10k usage credits',
          '3-month Scale minimum',
          'Monthly office hours',
          'Upgrade path to Dedicated',
        ],
      },
    ],
    related: [
      { label: 'Developer', to: '/pricing/developer' },
      { label: 'Scale', to: '/pricing/scale' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'academic',
    title: 'Academic',
    eyebrow: 'Pricing / Academic',
    summary: 'Reduced rates and shared capacity for research groups publishing open work.',
    meta: [
      { label: 'Discount', value: '40%' },
      { label: 'Eligibility', value: 'Research' },
      { label: 'Support', value: 'Community' },
    ],
    sections: [
      {
        title: 'Research on the network',
        body: [
          'Academic groups receive a 40% discount on Developer usage and access to shared capacity. The work must be non-commercial and publishable.',
          'We ask for a short description of the research and a public acknowledgement when results are published.',
        ],
        list: [
          '40% Developer discount',
          'Shared orbital nodes',
          'Research-only use',
          'Public acknowledgement',
        ],
      },
    ],
    related: [
      { label: 'Developer', to: '/pricing/developer' },
      { label: 'Models', to: '/models' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
];

/**
 * Finds a pricing sub-page by slug.
 * @param {string} slug
 * @returns {(typeof PRICING_PAGES)[number] | undefined}
 */
export function getPricingPage(slug) {
  return PRICING_PAGES.find((page) => page.slug === slug);
}
