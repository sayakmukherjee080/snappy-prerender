export const BLOG_POSTS = [
  {
    slug: 'orbital-latency',
    title: 'The short way is through the sky',
    date: '2026-10-14',
    category: 'Latency',
    author: 'Elena Voss',
    readTime: '6 min',
    excerpt: 'Why a 550 km detour beats a long fiber route, and where the physics stops helping.',
    sections: [
      {
        title: 'Fiber follows land',
        body: [
          'A terrestrial route is a negotiation with geography: rights of way, switching centres, and the places where a cable has to go around a mountain or a border.',
          'The orbital path is a great circle. At 550 km, the vacuum segment is short enough that the detour is worth it for long east–west routes.',
        ],
      },
      {
        title: 'Where it does not help',
        body: [
          'Short metro routes are already close to the speed of light in fiber. Orbit is not a universal latency win; it is a route-specific one.',
        ],
      },
    ],
    related: [
      { label: 'Latency routes', to: '/network/routes' },
      { label: 'Network', to: '/network/constellation' },
      { label: 'Platform', to: '/platform/hardware' },
    ],
  },
  {
    slug: 'ground-segment-design',
    title: 'The ground segment is the hard part',
    date: '2026-09-30',
    category: 'Network',
    author: 'Jonas Berg',
    readTime: '7 min',
    excerpt: 'How the ground segment was chosen, and why a station is more than an antenna.',
    sections: [
      {
        title: 'The station is the product',
        body: [
          'A ground station is a power site, a fiber path, a weather plan, and a local operations team. The antenna is the easy part.',
          'Every Aether station has redundant power and a direct fiber path to the metro it serves. A station outage should remove a path, not a city.',
        ],
      },
      {
        title: 'Remote by default',
        body: [
          'Svalbard and Awarua run with small on-site teams and a remote operations overlay. The design assumes the next anomaly happens at 04:00 UTC.',
        ],
      },
    ],
    related: [
      { label: 'Ground stations', to: '/network/ground-stations' },
      { label: 'Svalbard', to: '/network/ground-stations/svalbard' },
      { label: 'Awarua', to: '/network/ground-stations/awarua' },
    ],
  },
  {
    slug: 'radiation-hardened-inference',
    title: 'Inference in a radiation environment',
    date: '2026-09-12',
    category: 'Hardware',
    author: 'Dr. Arun Mehta',
    readTime: '8 min',
    excerpt: 'Single-event upsets are normal. The runtime has to make them invisible.',
    sections: [
      {
        title: 'Assume the bit flips',
        body: [
          'Radiation-tolerant hardware reduces the rate of upsets; it does not eliminate them. The design assumes an upset will happen during a request and makes the request recoverable.',
        ],
      },
      {
        title: 'Replay, not restart',
        body: [
          'The runtime keeps a ground-side request record and can replay a segment after a watchdog reset. The client sees a stream, not a reconnect.',
        ],
      },
    ],
    related: [
      { label: 'Radiation', to: '/platform/radiation' },
      { label: 'Compute', to: '/platform/compute' },
      { label: 'Reliability', to: '/platform/reliability' },
    ],
  },
  {
    slug: 'optical-mesh',
    title: 'Routing tokens through the mesh',
    date: '2026-08-26',
    category: 'Network',
    author: 'Rosa Delgado',
    readTime: '5 min',
    excerpt: 'Optical crosslinks let a request skip the ground. Here is when they are used.',
    sections: [
      {
        title: 'Crosslinks are a routing choice',
        body: [
          'A crosslink is not automatically faster. It wins when the ground path between two stations is longer than the optical path between the satellites.',
        ],
      },
      {
        title: 'Handoff state',
        body: [
          'The mesh carries KV cache and session state between nodes at T−90 seconds. The request ID stays the same across the switch.',
        ],
      },
    ],
    related: [
      { label: 'Handoff', to: '/network/handoff' },
      { label: 'Constellation', to: '/network/constellation' },
      { label: 'Runtime', to: '/platform/runtime' },
    ],
  },
  {
    slug: 'launch-cadence',
    title: 'A 90-day launch cadence',
    date: '2026-08-08',
    category: 'Operations',
    author: 'Elena Voss',
    readTime: '4 min',
    excerpt: 'Why capacity is scheduled by launch windows, not by procurement cycles.',
    sections: [
      {
        title: 'Capacity leaves the pad',
        body: [
          'A ground datacenter adds capacity when the building is ready. An orbital network adds capacity when the launch window opens.',
          'That makes the launch manifest a capacity plan, and the integration state a leading indicator of service.',
        ],
      },
      {
        title: 'The long pole is integration',
        body: [
          'The launch is visible; the clean-room integration is the actual constraint. Every node runs 1,200 hours in thermal-vacuum before it flies.',
        ],
      },
    ],
    related: [
      { label: 'Launch manifest', to: '/resources/launch-manifest' },
      { label: 'Hardware', to: '/platform/hardware' },
      { label: 'Timeline', to: '/company/about' },
    ],
  },
  {
    slug: 'power-budget',
    title: 'A 42 kW power budget',
    date: '2026-07-21',
    category: 'Hardware',
    author: 'Dr. Arun Mehta',
    readTime: '6 min',
    excerpt:
      'Solar array, battery buffer, and the accelerators that have to stay inside the envelope.',
    sections: [
      {
        title: 'Sun-synchronous arithmetic',
        body: [
          'The orbit keeps the array angle predictable and the eclipse short. The battery buffer covers the pass and the handoff.',
        ],
      },
      {
        title: 'Derating is the design',
        body: [
          'The node never runs the accelerators at the ground qualification limit. The margin is the thermal and electrical reserve that makes a bad pass survivable.',
        ],
      },
    ],
    related: [
      { label: 'Power', to: '/platform/power' },
      { label: 'Thermal', to: '/platform/thermal' },
      { label: 'Hardware', to: '/platform/hardware' },
    ],
  },
  {
    slug: 'edge-to-orbit',
    title: 'From the edge to orbit',
    date: '2026-07-02',
    category: 'Architecture',
    author: 'Jonas Berg',
    readTime: '5 min',
    excerpt: 'Where orbital inference fits in a stack that already has a ground region.',
    sections: [
      {
        title: 'Not a replacement',
        body: [
          'Orbit is another region, not a separate universe. Most customers keep a ground fallback and route only the latency-critical path through the mesh.',
        ],
      },
      {
        title: 'The migration shape',
        body: [
          'Change the base URL, shadow traffic, compare p50 and p95, then cut over with a rollback route. The client shape does not change.',
        ],
      },
    ],
    related: [
      { label: 'Migration', to: '/resources/migration' },
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Pricing', to: '/pricing' },
    ],
  },
];

export const MISSION_LOG = [
  {
    slug: '2026-10-12',
    title: 'Handoff trace, 04:12 UTC',
    date: '2026-10-12',
    category: 'Mission log',
    author: 'Mission operations',
    readTime: '3 min',
    excerpt: 'A routine P1 to P2 handoff, with the state mirror and stream continuity confirmed.',
    sections: [
      {
        title: 'What happened',
        body: [
          'Aether-02 mirrored 2.4 GB of KV cache to Aether-03 at T−90 seconds. The client stream continued under the same request ID; no reconnect was observed.',
        ],
      },
      {
        title: 'What changed',
        body: [
          'The handoff trace now exposes the mirror start, the switch, and the drain as separate events in the telemetry API.',
        ],
      },
    ],
    related: [
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Handoff', to: '/network/handoff' },
      { label: 'Aether-02', to: '/network/satellites/aether-02' },
    ],
  },
  {
    slug: '2026-09-28',
    title: 'Madrid station enters service',
    date: '2026-09-28',
    category: 'Mission log',
    author: 'Ground network',
    readTime: '3 min',
    excerpt:
      'The eighth ground station is online, adding the EU fiber handoff and a second residency boundary.',
    sections: [
      {
        title: 'What happened',
        body: [
          'Madrid completed its acceptance test and began carrying production traffic to Frankfurt. The station adds a second EU path and a named data boundary.',
        ],
      },
      {
        title: 'What changed',
        body: [
          'Regional routing can now pin EU traffic to Madrid. The route map and residency table were updated in the same release.',
        ],
      },
    ],
    related: [
      { label: 'Madrid', to: '/network/ground-stations/madrid' },
      { label: 'Data residency', to: '/resources/data-residency' },
      { label: 'Status', to: '/resources/status' },
    ],
  },
  {
    slug: '2026-08-14',
    title: 'Aether-06 reaches highest sustained load',
    date: '2026-08-14',
    category: 'Mission log',
    author: 'Mission operations',
    readTime: '2 min',
    excerpt: 'A 91% node load with no dropped tokens and a stable radiator profile.',
    sections: [
      {
        title: 'What happened',
        body: [
          'Aether-06 sustained 91% node load through an APAC peak, with the radiator holding at 24.0 °C and no handoff interruption.',
        ],
      },
      {
        title: 'What changed',
        body: [
          'The scheduler now weights P5 handoffs slightly earlier when the receiving node is above 85% load.',
        ],
      },
    ],
    related: [
      { label: 'Aether-06', to: '/network/satellites/aether-06' },
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Reliability', to: '/platform/reliability' },
    ],
  },
  {
    slug: '2026-07-03',
    title: 'Perth and Kourou come online',
    date: '2026-07-03',
    category: 'Mission log',
    author: 'Ground network',
    readTime: '3 min',
    excerpt: 'Two stations, two new corridors, and the first 20 Gbps optical link.',
    sections: [
      {
        title: 'What happened',
        body: [
          'Perth and Kourou completed acceptance and began carrying traffic. The first 20 Gbps optical link was established from Aether-05 to Perth.',
        ],
      },
      {
        title: 'What changed',
        body: [
          'The Indian Ocean and equatorial Atlantic routes are now live. The status page lists both stations separately from the orbital mesh.',
        ],
      },
    ],
    related: [
      { label: 'Perth', to: '/network/ground-stations/perth' },
      { label: 'Kourou', to: '/network/ground-stations/kourou' },
      { label: 'Aether-05', to: '/network/satellites/aether-05' },
    ],
  },
  {
    slug: '2026-06-19',
    title: 'First 128k request over a handoff',
    date: '2026-06-19',
    category: 'Mission log',
    author: 'Inference runtime',
    readTime: '2 min',
    excerpt: 'A long-context request crossed a satellite boundary without a client reconnect.',
    sections: [
      {
        title: 'What happened',
        body: [
          'A 128k-context request started on Aether-03 and completed on Aether-04 after a scheduled handoff. The stream stayed open and the usage record stayed under one request ID.',
        ],
      },
      {
        title: 'What changed',
        body: [
          'The KV cache mirror path now includes the long-context segment map, so the receiving node does not rebuild the cache from scratch.',
        ],
      },
    ],
    related: [
      { label: 'Aether-03', to: '/network/satellites/aether-03' },
      { label: 'Aether-04', to: '/network/satellites/aether-04' },
      { label: 'Runtime', to: '/platform/runtime' },
    ],
  },
];
