export const RESOURCES = [
  {
    slug: 'support',
    title: 'Support',
    summary:
      'How to reach a human, what to include, and the escalation path for production incidents.',
    meta: [
      { label: 'Response', value: '2 business days' },
      { label: 'Incidents', value: '24/7' },
      { label: 'Channel', value: 'Email · Slack' },
    ],
    sections: [
      {
        title: 'Start with the request ID',
        body: [
          'Include the request ID, workspace, region, model, and a timestamp in UTC. For streaming issues, include the last event you received.',
        ],
      },
      {
        title: 'Escalation',
        body: [
          'Scale customers have a shared Slack channel with an inference engineer. Dedicated customers have a named mission team and a 24/7 incident path.',
        ],
        list: [
          'Developer: community support',
          'Scale: Slack + engineer',
          'Dedicated: named mission team',
          'Security: security@aethercompute.space',
        ],
      },
    ],
    related: [
      { label: 'Status', to: '/resources/status' },
      { label: 'Errors', to: '/docs/guides/errors' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'faq',
    title: 'FAQ',
    summary: 'Short answers to the questions that come up before a first orbital route.',
    widget: 'faq',
    sections: [
      {
        title: 'The short version',
        body: [
          'Aether serves LLM inference from low Earth orbit. You keep your existing OpenAI-compatible client, point it at the orbital endpoint, and pay per token.',
        ],
      },
    ],
    related: [
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Security', to: '/platform/security' },
    ],
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    summary: 'The vocabulary of orbital inference, from plane to handoff window.',
    widget: 'glossary',
    sections: [
      {
        title: 'Why a glossary',
        body: [
          'Orbital infrastructure has its own vocabulary. This page keeps the terms in one place so a route review does not turn into a physics lecture.',
        ],
      },
    ],
    related: [
      { label: 'Network', to: '/network/constellation' },
      { label: 'Handoff', to: '/network/handoff' },
      { label: 'Docs', to: '/docs' },
    ],
  },
  {
    slug: 'status',
    title: 'Service status',
    summary:
      'Current state, planned maintenance, and the incident history for the orbital network.',
    widget: 'status-table',
    sections: [
      {
        title: 'How to read it',
        body: [
          'The status table lists each ground station and the orbital mesh separately. A station outage does not necessarily remove a metro from the network.',
        ],
      },
    ],
    related: [
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Incident history', to: '/resources/incident-history' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
  {
    slug: 'brand',
    title: 'Brand kit',
    summary: 'The wordmark, the orbital mark, and the colours that keep the network recognisable.',
    widget: 'brand-kit',
    sections: [
      {
        title: 'Use the mark intact',
        body: [
          'Do not stretch, recolour, or add effects to the orbital mark. The safety orange is reserved for action and key data.',
        ],
      },
    ],
    related: [
      { label: 'Press', to: '/company/press' },
      { label: 'About', to: '/company/about' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'launch-manifest',
    title: 'Launch manifest',
    summary:
      'The nodes assigned to each launch window, their planes, and their current integration state.',
    widget: 'launch-manifest',
    sections: [
      {
        title: 'Manifest discipline',
        body: [
          'A launch slot is not a promise of service. The manifest shows integration state, and the constellation page shows what is actually on orbit.',
        ],
      },
    ],
    related: [
      { label: 'Constellation', to: '/network/constellation' },
      { label: 'Satellites', to: '/network/constellation' },
      { label: 'Timeline', to: '/company/about' },
    ],
  },
  {
    slug: 'orbit-calculator',
    title: 'Orbit calculator',
    summary: 'A small interactive model of altitude, period, and round-trip time.',
    widget: 'orbit-calculator',
    sections: [
      {
        title: 'What it models',
        body: [
          'The calculator uses a circular orbit and the speed of light in vacuum. It ignores atmospheric drag, ground processing, and fiber routing.',
        ],
      },
    ],
    related: [
      { label: 'Latency routes', to: '/network/routes' },
      { label: 'Constellation', to: '/network/constellation' },
      { label: 'Physics', to: '/platform/hardware' },
    ],
  },
  {
    slug: 'migration',
    title: 'Migration center',
    summary: 'Move an existing workload to orbit without changing the client shape.',
    meta: [
      { label: 'Change', value: 'Base URL' },
      { label: 'Client', value: 'Compatible' },
      { label: 'Rollback', value: 'Ground route' },
    ],
    sections: [
      {
        title: 'The short path',
        body: [
          'Change the base URL and the key, then shadow a percentage of traffic. Keep the ground route warm until the orbital route is inside your SLO.',
        ],
        list: [
          'Map model names',
          'Shadow 5% of traffic',
          'Compare p50 and p95',
          'Cut over with a rollback route',
        ],
      },
    ],
    related: [
      { label: 'Migration guide', to: '/docs/guides/migration' },
      { label: 'Models', to: '/models' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
  {
    slug: 'community',
    title: 'Community',
    summary: 'Where builders share routes, benchmarks, and the occasional anomaly story.',
    meta: [
      { label: 'Forum', value: 'Open' },
      { label: 'Office hours', value: 'Monthly' },
      { label: 'Status', value: 'Public' },
    ],
    sections: [
      {
        title: 'Show your route',
        body: [
          'Share a route trace, a benchmark, or a migration note. The community forum is the fastest place to ask whether a p50 number is plausible.',
        ],
      },
      {
        title: 'Office hours',
        body: [
          'Monthly office hours cover runtime changes, new models, and route planning. Recordings are posted with the changelog.',
        ],
      },
    ],
    related: [
      { label: 'Changelog', to: '/docs/changelog/2026-10' },
      { label: 'Support', to: '/resources/support' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    slug: 'data-residency',
    title: 'Data residency',
    summary: 'Which ground segments keep traffic inside which jurisdiction.',
    widget: 'residency-table',
    sections: [
      {
        title: 'The route is the boundary',
        body: [
          'Residency is enforced by the ground segment and the routing policy, not by a promise in a contract. The table lists the available boundaries.',
        ],
      },
    ],
    related: [
      { label: 'Security', to: '/platform/security' },
      { label: 'DPA', to: '/legal/dpa' },
      { label: 'Trust center', to: '/legal/trust-center' },
    ],
  },
  {
    slug: 'incident-history',
    title: 'Incident history',
    summary: 'A public log of network incidents, handoff anomalies, and planned maintenance.',
    widget: 'incident-history',
    sections: [
      {
        title: 'Written after the fact',
        body: [
          'Incident notes are published after the immediate response. They include the timeline, the customer impact, and the change that prevents a repeat.',
        ],
      },
    ],
    related: [
      { label: 'Status', to: '/resources/status' },
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
];

/**
 * Finds a resource page by slug.
 * @param {string} slug
 * @returns {(typeof RESOURCES)[number] | undefined}
 */
export function getResource(slug) {
  return RESOURCES.find((resource) => resource.slug === slug);
}
