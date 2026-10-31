export const NETWORK_CORE_PAGES = [
  {
    slug: 'constellation',
    title: 'One constellation, six planes',
    eyebrow: 'Network / Constellation',
    summary:
      'Twenty-four satellites in six planes, linked by laser and anchored by eight ground stations.',
    meta: [
      { label: 'Satellites', value: '24 planned' },
      { label: 'Planes', value: '6' },
      { label: 'Inclination', value: '97.6°' },
    ],
    widget: 'constellation-map',
    sections: [
      {
        title: 'The mesh is the datacenter',
        body: [
          'Each plane is a ring of four satellites at 550 km. Crosslinks connect neighbours in and across planes, so a request can travel from Svalbard to Hawaii without touching the ground.',
          'The constellation is designed for continuous coverage between 60°N and 55°S, with store-and-forward outside that band.',
        ],
      },
      {
        title: 'Plane status',
        body: [
          'Six nodes are active today. The remaining eighteen are in integration, manifest, or planned states, with launch windows through 2027.',
        ],
        list: ['P1–P5 active', 'P6 in integration', '24 nodes planned by 2027'],
      },
    ],
    related: [
      { label: 'Satellites', to: '/network/satellites/aether-01' },
      { label: 'Ground stations', to: '/network/ground-stations' },
      { label: 'Handoff', to: '/network/handoff' },
    ],
  },
  {
    slug: 'ground-stations',
    title: 'Eight stations, one fiber handoff',
    eyebrow: 'Network / Ground segment',
    summary:
      'Private cages, redundant power, and a direct fiber path to the metro each station serves.',
    meta: [
      { label: 'Stations', value: '8' },
      { label: 'Continents', value: '4' },
      { label: 'Uplink', value: '20 Gbps' },
    ],
    widget: 'station-table',
    sections: [
      {
        title: 'The station is the product',
        body: [
          'A ground station is a power site, a fiber path, a weather plan, and a local operations team. The antenna is the easy part.',
          'Every station has redundant power and a direct fiber path to the metro it serves. A station outage removes a path, not a city.',
        ],
      },
    ],
    related: [
      { label: 'Svalbard', to: '/network/ground-stations/svalbard' },
      { label: 'Awarua', to: '/network/ground-stations/awarua' },
      { label: 'Data residency', to: '/resources/data-residency' },
    ],
  },
  {
    slug: 'routes',
    title: 'The route matters more than the distance',
    eyebrow: 'Network / Routes',
    summary:
      'Modeled p50 for the orbital path and the terrestrial fiber path on the same corridor.',
    widget: 'latency-chart',
    sections: [
      {
        title: 'Fiber follows land',
        body: [
          'The orbital path follows the great circle. For long east–west routes, that is the difference between 18 and 31 milliseconds.',
          'Short metro routes are already close to the speed of light in fiber. Orbit is a route-specific win, not a universal one.',
        ],
      },
    ],
    related: [
      { label: 'Latency', to: '/network/telemetry' },
      { label: 'Constellation', to: '/network/constellation' },
      { label: 'Ground stations', to: '/network/ground-stations' },
    ],
  },
  {
    slug: 'handoff',
    title: 'The horizon is a scheduled event',
    eyebrow: 'Network / Handoff',
    summary:
      'State mirroring at T−90 seconds, an optical switch, and a stream that does not reconnect.',
    meta: [
      { label: 'Lead time', value: '90 s' },
      { label: 'State', value: '2.4 GB' },
      { label: 'Interruption', value: '0 ms' },
    ],
    widget: 'handoff-steps',
    sections: [
      {
        title: 'Nothing is reactive',
        body: [
          'Orbit determination forecasts loss of signal to the second. The next node is selected, warmed, and mirrored before the current one goes dark.',
          'The client keeps the same request ID and event stream across the switch.',
        ],
      },
    ],
    related: [
      { label: 'Runtime', to: '/platform/runtime' },
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Reliability', to: '/platform/reliability' },
    ],
  },
  {
    slug: 'telemetry',
    title: 'A snapshot from the mesh',
    eyebrow: 'Network / Telemetry',
    summary:
      'Node load, radiator temperature, and optical link state for the active constellation.',
    widget: 'telemetry-table',
    sections: [
      {
        title: 'Illustrative snapshot',
        body: [
          'This page shows a deterministic snapshot for the demo. Production telemetry is available to customers over the API.',
          'No customer prompts or outputs appear in network telemetry.',
        ],
      },
    ],
    related: [
      { label: 'Status', to: '/resources/status' },
      { label: 'Handoff', to: '/network/handoff' },
      { label: 'Satellites', to: '/network/satellites/aether-02' },
    ],
  },
];

/**
 * Finds a network core page by slug.
 * @param {string} slug
 * @returns {(typeof NETWORK_CORE_PAGES)[number] | undefined}
 */
export function getNetworkCorePage(slug) {
  return NETWORK_CORE_PAGES.find((page) => page.slug === slug);
}
