export const CUSTOMERS = [
  {
    slug: 'meridian-ai',
    name: 'Meridian AI',
    industry: 'AI infrastructure',
    summary: 'Moved latency-critical inference to orbit and cut p50 response time by 38%.',
    quote: 'The orbital handoffs are invisible to our users. That is the whole product.',
    author: 'Dr. Maya Chen, VP Infrastructure',
    metrics: [
      { label: 'p50 reduction', value: '38%' },
      { label: 'Routes', value: '12' },
      { label: 'Uptime', value: '99.98%' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Meridian served interactive agents from a single ground region. Users in long-haul fiber markets saw p50 above 60 ms before the model produced a token.',
        ],
      },
      {
        title: 'The move',
        body: [
          'They shifted the latency-critical route to Aether Scale, kept a ground fallback, and compared p50 and p95 for six weeks before cutting over.',
        ],
        list: [
          'Scale plan with priority routing',
          'Regional ground relay',
          'Ground fallback retained',
          'Six-week shadow comparison',
        ],
      },
      {
        title: 'The result',
        body: [
          'p50 fell by 38% on the affected routes. Handoffs did not surface as reconnects, and the ground fallback has not been needed in production.',
        ],
      },
    ],
    related: [
      { label: 'Scale plan', to: '/pricing/scale' },
      { label: 'Network', to: '/network/constellation' },
      { label: 'Latency', to: '/network/routes' },
    ],
  },
  {
    slug: 'northstar-labs',
    name: 'Northstar Labs',
    industry: 'Research',
    summary: 'Runs reproducible long-context experiments across a shared orbital route.',
    quote: 'We stopped treating latency as a constant and started treating it as a route.',
    author: 'Priya Raman, Research Director',
    metrics: [
      { label: 'Context', value: '128k' },
      { label: 'Experiments', value: '2.4k' },
      { label: 'Cost', value: '−22%' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Northstar needed long-context evaluation runs without building a dedicated cluster for a six-month research program.',
        ],
      },
      {
        title: 'The move',
        body: [
          'The lab used Developer and Scale capacity with pinned model checkpoints, then published route traces alongside its results.',
        ],
      },
      {
        title: 'The result',
        body: [
          'The team ran 2,400 experiments at 22% lower cost than its previous ground provider, with reproducible request IDs for every run.',
        ],
      },
    ],
    related: [
      { label: 'Academic pricing', to: '/pricing/academic' },
      { label: 'Models', to: '/models' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
    ],
  },
  {
    slug: 'helix-research',
    name: 'Helix Research',
    industry: 'Life sciences',
    summary:
      'Keeps sensitive research prompts inside a dedicated orbital node and a private ground relay.',
    quote: 'The data boundary had to be explicit before the model could be useful.',
    author: 'Dr. Elias Ward, Head of Compute',
    metrics: [
      { label: 'Isolation', value: 'Dedicated' },
      { label: 'Retention', value: 'None' },
      { label: 'Regions', value: '2' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Helix could not send research prompts through a shared multi-tenant route, even with encryption in transit.',
        ],
      },
      {
        title: 'The move',
        body: [
          'A dedicated node and a private ground relay kept the path inside the approved jurisdictions. Customer keys stayed in the ground HSM.',
        ],
      },
      {
        title: 'The result',
        body: [
          'The research team has a production reasoning endpoint without changing its data-boundary review process.',
        ],
      },
    ],
    related: [
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'Security', to: '/platform/security' },
      { label: 'Trust center', to: '/legal/trust-center' },
    ],
  },
  {
    slug: 'parallax',
    name: 'Parallax',
    industry: 'Logistics',
    summary: 'Adds reasoning to remote port operations without building a local datacenter.',
    quote: 'The port does not need a server room. It needs a reliable answer.',
    author: 'Tomás Ferreira, VP Engineering',
    metrics: [
      { label: 'Sites', value: '18' },
      { label: 'Routes', value: '6' },
      { label: 'Local model', value: 'Fallback' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Parallax operates at ports where the local link is thin and the nearest cloud region is far away.',
        ],
      },
      {
        title: 'The move',
        body: [
          'Heavy document reasoning moved to orbit; a small local model handles the decisions that cannot wait for a pass.',
        ],
      },
      {
        title: 'The result',
        body: [
          'Eighteen sites now use the same reasoning endpoint, with a local fallback for link loss and a clear route map for each region.',
        ],
      },
    ],
    related: [
      { label: 'Logistics solution', to: '/solutions/logistics' },
      { label: 'Regions', to: '/regions' },
      { label: 'Network', to: '/network' },
    ],
  },
  {
    slug: 'vector-foundry',
    name: 'Vector Foundry',
    industry: 'Developer tools',
    summary: 'Runs code review and test synthesis on a 128k-context orbital route.',
    quote: 'The model sees the whole diff, not the chunk we could afford to send.',
    author: 'Nadia Park, CTO',
    metrics: [
      { label: 'Context', value: '128k' },
      { label: 'Reviews', value: '31k' },
      { label: 'p50', value: '24 ms' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Vector Foundry needed multi-file context for code review, but its ground provider charged enough for long context that the product margin disappeared.',
        ],
      },
      {
        title: 'The move',
        body: [
          'The team moved review and test synthesis to Aether Code on Scale, keeping execution in its own sandbox.',
        ],
      },
      {
        title: 'The result',
        body: [
          'The product now sends the whole diff, not a truncated chunk, and the review queue clears in a single pass.',
        ],
      },
    ],
    related: [
      { label: 'Code model', to: '/models/aether-code' },
      { label: 'Tool calling', to: '/docs/guides/tools' },
      { label: 'Scale', to: '/pricing/scale' },
    ],
  },
  {
    slug: 'orbital-bio',
    name: 'Orbital Bio',
    industry: 'Healthcare',
    summary: 'Uses private inference for clinical documentation in two jurisdictions.',
    quote: 'The route is part of the compliance story, not an afterthought.',
    author: 'Dr. Lena Ortiz, Chief Medical Information Officer',
    metrics: [
      { label: 'Jurisdictions', value: '2' },
      { label: 'Retention', value: 'None' },
      { label: 'Nodes', value: 'Dedicated' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Orbital Bio needed a documentation assistant that stayed inside the data-boundary review for two clinical networks.',
        ],
      },
      {
        title: 'The move',
        body: [
          'Dedicated nodes and regional relays kept each network on its own path. Prompts were discarded after the response.',
        ],
      },
      {
        title: 'The result',
        body: [
          'The documentation workflow passed review without a new data-processing exception, and the clinical teams kept their existing validation process.',
        ],
      },
    ],
    related: [
      { label: 'Healthcare solution', to: '/solutions/healthcare' },
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'Data residency', to: '/resources/data-residency' },
    ],
  },
  {
    slug: 'lumen-media',
    name: 'Lumen Media',
    industry: 'Media',
    summary: 'Captioning and moderation for live events across three continents.',
    quote: 'The audience is everywhere. The model should be closer to them.',
    author: 'Marco Silva, Head of Live Operations',
    metrics: [
      { label: 'Events', value: '140' },
      { label: 'Regions', value: '3' },
      { label: 'Burst', value: 'Scale' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Lumen produces live events for audiences in three regions, but its captioning model lived in one ground region.',
        ],
      },
      {
        title: 'The move',
        body: [
          'Captioning and moderation moved to the nearest orbital relay, with Scale capacity for event bursts.',
        ],
      },
      {
        title: 'The result',
        body: [
          'The production team runs 140 events a year on the same route, with a named escalation path for live windows.',
        ],
      },
    ],
    related: [
      { label: 'Media solution', to: '/solutions/media' },
      { label: 'Vision model', to: '/models/aether-vision' },
      { label: 'Scale', to: '/pricing/scale' },
    ],
  },
  {
    slug: 'atlas-robotics',
    name: 'Atlas Robotics',
    industry: 'Robotics',
    summary: 'Adds a reasoning loop to remote inspection fleets with a local safety controller.',
    quote: 'The robot keeps the reflexes. The orbit keeps the reasoning.',
    author: 'Hana Ito, Autonomy Lead',
    metrics: [
      { label: 'Fleet', value: '64' },
      { label: 'Sites', value: '9' },
      { label: 'Fallback', value: 'On board' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Atlas needed a reasoning layer for inspection fleets operating beyond reliable connectivity, without moving the hard real-time controller off the robot.',
        ],
      },
      {
        title: 'The move',
        body: [
          'The slow reasoning loop moved to Aether Vision; the safety controller stayed on board with a local fallback.',
        ],
      },
      {
        title: 'The result',
        body: [
          'Sixty-four robots now share the same reasoning endpoint, and the safety boundary is unchanged.',
        ],
      },
    ],
    related: [
      { label: 'Robotics solution', to: '/solutions/robotics' },
      { label: 'Vision model', to: '/models/aether-vision' },
      { label: 'Network', to: '/network/constellation' },
    ],
  },
  {
    slug: 'signal-bank',
    name: 'Signal Bank',
    industry: 'Finance',
    summary: 'Regional document review with dedicated isolation and a named mission team.',
    quote: 'The latency win was real. The isolation story closed the review.',
    author: 'Amara Okafor, Head of Platform',
    metrics: [
      { label: 'Documents', value: '1.2M' },
      { label: 'Isolation', value: 'Dedicated' },
      { label: 'Regions', value: '2' },
    ],
    sections: [
      {
        title: 'The problem',
        body: [
          'Signal Bank needed faster document review for regional offices, but the data-boundary review ruled out a shared inference route.',
        ],
      },
      {
        title: 'The move',
        body: [
          'A dedicated node and private ground segments kept the path inside the approved regions. The bank kept its own validation and review workflow.',
        ],
      },
      {
        title: 'The result',
        body: [
          'The review process passed, and the regional teams now use a single endpoint for extraction and memo drafting.',
        ],
      },
    ],
    related: [
      { label: 'Finance solution', to: '/solutions/finance' },
      { label: 'Dedicated', to: '/pricing/dedicated' },
      { label: 'Security', to: '/platform/security' },
    ],
  },
];

/**
 * Finds a customer case study by slug.
 * @param {string} slug
 * @returns {(typeof CUSTOMERS)[number] | undefined}
 */
export function getCustomer(slug) {
  return CUSTOMERS.find((customer) => customer.slug === slug);
}
