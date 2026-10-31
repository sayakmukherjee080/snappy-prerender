export const SOLUTIONS = [
  {
    slug: 'finance',
    title: 'Finance',
    summary:
      'Low-latency document intelligence and risk review, routed away from crowded fiber corridors.',
    meta: [
      { label: 'Latency', value: '18–24 ms' },
      { label: 'Residency', value: 'Regional' },
      { label: 'Isolation', value: 'Dedicated' },
    ],
    sections: [
      {
        title: 'Where orbit helps',
        body: [
          'Market-adjacent inference benefits when the ground route is long and the model is latency-sensitive. Orbital routing shortens the path between regional offices and the model.',
        ],
        list: [
          'Document extraction',
          'Risk memo drafting',
          'Client query routing',
          'Multilingual review',
        ],
      },
      {
        title: 'Controls',
        body: [
          'Dedicated nodes, regional ground segments, zero prompt retention, and a DPA that names the routing boundary.',
        ],
      },
    ],
    related: [
      { label: 'Enterprise', to: '/pricing/enterprise' },
      { label: 'Security', to: '/platform/security' },
      { label: 'Customer: Signal Bank', to: '/customers/signal-bank' },
    ],
  },
  {
    slug: 'healthcare',
    title: 'Healthcare',
    summary:
      'Private inference for clinical documentation and imaging workflows at regional edges.',
    meta: [
      { label: 'Isolation', value: 'Dedicated' },
      { label: 'Retention', value: 'None' },
      { label: 'Audit', value: 'Available' },
    ],
    sections: [
      {
        title: 'Clinical support, not diagnosis',
        body: [
          'Aether is infrastructure, not a medical device. Customers run their own validated models for documentation, coding, and image triage.',
        ],
      },
      {
        title: 'Data boundary',
        body: [
          'Prompts are not retained in orbit. Dedicated nodes and private ground segments keep the data path inside a named jurisdiction.',
        ],
      },
    ],
    related: [
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'Trust center', to: '/legal/trust-center' },
      { label: 'Customer: Orbital Bio', to: '/customers/orbital-bio' },
    ],
  },
  {
    slug: 'robotics',
    title: 'Robotics',
    summary:
      'A low-latency reasoning layer for fleets operating beyond reliable terrestrial connectivity.',
    meta: [
      { label: 'Coverage', value: 'Remote' },
      { label: 'Handoff', value: 'Seamless' },
      { label: 'Models', value: 'Vision + code' },
    ],
    sections: [
      {
        title: 'Reasoning where the fiber ends',
        body: [
          'Orbital inference gives remote fleets a reasoning endpoint without building a local datacenter. The model can sit above the horizon rather than in the vehicle.',
        ],
      },
      {
        title: 'Safety boundary',
        body: [
          'The robot keeps its hard real-time controller on board. Aether serves the slower reasoning loop, with a local fallback when the link is unavailable.',
        ],
      },
    ],
    related: [
      { label: 'Vision model', to: '/models/aether-vision' },
      { label: 'Network', to: '/network/constellation' },
      { label: 'Customer: Atlas Robotics', to: '/customers/atlas-robotics' },
    ],
  },
  {
    slug: 'defense',
    title: 'Defense',
    summary:
      'Sovereign orbital inference with private ground segments and hardware-level isolation.',
    meta: [
      { label: 'Mode', value: 'Sovereign' },
      { label: 'Ground', value: 'Private' },
      { label: 'SLA', value: '99.99%' },
    ],
    sections: [
      {
        title: 'Sovereign by construction',
        body: [
          'A sovereign deployment reserves a satellite and a ground segment. The customer controls the routing boundary, the keys, and the model image.',
        ],
      },
      {
        title: 'Export and review',
        body: [
          'Programs are reviewed case by case against export controls and mission requirements. We do not claim a certification we have not earned.',
        ],
      },
    ],
    related: [
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'Deployments', to: '/platform/deployments' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'research',
    title: 'Research',
    summary: 'Shared orbital capacity and academic rates for groups publishing open work.',
    meta: [
      { label: 'Discount', value: '40%' },
      { label: 'Access', value: 'Shared' },
      { label: 'Use', value: 'Non-commercial' },
    ],
    sections: [
      {
        title: 'A different vantage point',
        body: [
          'Research groups use the constellation to study latency, routing, and radiation-tolerant inference under real orbital constraints.',
        ],
      },
      {
        title: 'Publish the result',
        body: [
          'Academic access requires non-commercial use and a public acknowledgement. We can provide route traces for reproducible work.',
        ],
      },
    ],
    related: [
      { label: 'Academic pricing', to: '/pricing/academic' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
      { label: 'Customer: Helix Research', to: '/customers/helix-research' },
    ],
  },
  {
    slug: 'media',
    title: 'Media',
    summary: 'Real-time captioning, translation, and moderation for distributed production teams.',
    meta: [
      { label: 'Latency', value: 'Low p50' },
      { label: 'Models', value: 'Vision + text' },
      { label: 'Routing', value: 'Regional' },
    ],
    sections: [
      {
        title: 'Live production',
        body: [
          'Media teams use the network for captioning, translation, and moderation where the audience and the production crew are in different regions.',
        ],
      },
      {
        title: 'Burst capacity',
        body: [
          'Scale handles event bursts with priority routing; dedicated nodes cover the flagship production window.',
        ],
      },
    ],
    related: [
      { label: 'Scale', to: '/pricing/scale' },
      { label: 'Vision model', to: '/models/aether-vision' },
      { label: 'Customer: Lumen Media', to: '/customers/lumen-media' },
    ],
  },
  {
    slug: 'gaming',
    title: 'Gaming',
    summary: 'NPC dialogue and live moderation where player latency is the product.',
    meta: [
      { label: 'Latency', value: 'p50 first' },
      { label: 'Models', value: 'Mini + 8B' },
      { label: 'Scale', value: 'Burst' },
    ],
    sections: [
      {
        title: 'Dialogue at the edge',
        body: [
          'Small models handle routing and short dialogue; the 8B handles the longer character turns. The orbital path keeps the round trip short for players far from the studio region.',
        ],
      },
      {
        title: 'Moderation',
        body: [
          'Run moderation on the same route as generation so a policy decision does not add a second ground hop.',
        ],
      },
    ],
    related: [
      { label: 'Mini', to: '/models/aether-mini' },
      { label: '8B', to: '/models/aether-8b' },
      { label: 'Estimator', to: '/pricing/estimator' },
    ],
  },
  {
    slug: 'legal',
    title: 'Legal',
    summary:
      'Contract review and research across regional offices without moving the data further than necessary.',
    meta: [
      { label: 'Residency', value: 'Regional' },
      { label: 'Context', value: '128k' },
      { label: 'Retention', value: 'None' },
    ],
    sections: [
      {
        title: 'Long documents',
        body: [
          'The 128k context handles contracts, filings, and discovery sets without a chunking pipeline in front of the model.',
        ],
      },
      {
        title: 'Review, not advice',
        body: [
          'Aether provides the inference layer. Customers remain responsible for the legal judgement and the validation of every extracted clause.',
        ],
      },
    ],
    related: [
      { label: '70B Instruct', to: '/models/aether-70b-instruct' },
      { label: 'Enterprise', to: '/pricing/enterprise' },
      { label: 'DPA', to: '/legal/dpa' },
    ],
  },
  {
    slug: 'logistics',
    title: 'Logistics',
    summary:
      'Route reasoning and document extraction for fleets crossing regions with uneven connectivity.',
    meta: [
      { label: 'Coverage', value: 'Remote' },
      { label: 'Models', value: 'Vision + text' },
      { label: 'Routing', value: 'Nearest relay' },
    ],
    sections: [
      {
        title: 'The long tail of the network',
        body: [
          'Orbital inference reaches ports, ships, and remote depots where a terrestrial datacenter is far away and the local link is thin.',
        ],
      },
      {
        title: 'Ground fallback',
        body: [
          'Keep a small local model for the decisions that cannot wait for a pass. The orbital route handles the heavier reasoning when the link is available.',
        ],
      },
    ],
    related: [
      { label: 'Network', to: '/network/constellation' },
      { label: 'Regions', to: '/regions' },
      { label: 'Customer: Parallax', to: '/customers/parallax' },
    ],
  },
  {
    slug: 'energy',
    title: 'Energy',
    summary: 'Inspection and operations support for remote generation and grid assets.',
    meta: [
      { label: 'Models', value: 'Vision' },
      { label: 'Coverage', value: 'Remote' },
      { label: 'Ground', value: 'Regional' },
    ],
    sections: [
      {
        title: 'Inspect where the asset is',
        body: [
          'Vision inference can inspect turbine blades, panels, and substations without shipping imagery to a distant region first.',
        ],
      },
      {
        title: 'Operational discipline',
        body: [
          'Extracted findings are validated on the ground before they enter a maintenance system. The model is an assistant, not the control loop.',
        ],
      },
    ],
    related: [
      { label: 'Vision model', to: '/models/aether-vision' },
      { label: 'Regions', to: '/regions' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'telecom',
    title: 'Telecom',
    summary: 'A reasoning layer for network operations teams spread across many ground segments.',
    meta: [
      { label: 'Routing', value: 'Regional' },
      { label: 'Models', value: 'Text' },
      { label: 'SLA', value: '99.9%' },
    ],
    sections: [
      {
        title: 'The network above the network',
        body: [
          'Telecom operators use orbital inference for ticket triage, field guidance, and network summaries where the operations team is distributed across regions.',
        ],
      },
      {
        title: 'Carrier-grade expectations',
        body: [
          'Regional routing, a named support path, and a 99.9% SLA on Scale. Dedicated capacity is available for the operations center.',
        ],
      },
    ],
    related: [
      { label: 'Scale', to: '/pricing/scale' },
      { label: 'Network', to: '/network' },
      { label: 'SLA', to: '/legal/sla' },
    ],
  },
];

/**
 * Finds a solution page by slug.
 * @param {string} slug
 * @returns {(typeof SOLUTIONS)[number] | undefined}
 */
export function getSolution(slug) {
  return SOLUTIONS.find((solution) => solution.slug === slug);
}
