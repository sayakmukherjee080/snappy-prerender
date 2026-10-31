export const PLATFORM_PAGES = [
  {
    slug: 'hardware',
    title: 'The orbital node',
    eyebrow: 'Platform / Hardware',
    summary:
      'A complete inference appliance designed for launch, vacuum, radiation, and a ten-year replacement cycle.',
    meta: [
      { label: 'Mass', value: '1,840 kg' },
      { label: 'Power', value: '42 kW' },
      { label: 'Compute', value: '1.2 PFLOPS FP8' },
    ],
    sections: [
      {
        title: 'Built as a replaceable unit',
        body: [
          'The node is a single orbital replacement unit: compute tray, power bus, thermal loop, and optical terminal integrated behind one separation ring.',
          'Every connector is keyed, every fastener is captively retained, and every software image is signed before integration.',
        ],
        list: [
          '8 accelerators · 192 GB HBM3e',
          '42 kW GaAs solar array',
          '38 kW deployable radiator',
          '2 × 10 Gbps optical terminals',
        ],
      },
      {
        title: 'Qualified beyond the mission',
        body: [
          'Flight units are derated from ground qualification limits and screened for single-event upsets before launch.',
          'The Aether-2 block adds a second radiator loop and a wider battery buffer for eclipse-heavy planes.',
        ],
      },
    ],
    related: [
      { label: 'Compute', to: '/platform/compute' },
      { label: 'Thermal', to: '/platform/thermal' },
      { label: 'Deployments', to: '/platform/deployments' },
    ],
  },
  {
    slug: 'compute',
    title: 'Compute that survives the sky',
    eyebrow: 'Platform / Compute',
    summary:
      'Eight radiation-tolerant accelerators, ECC memory, and a runtime that treats every token as a recoverable event.',
    meta: [
      { label: 'FP8', value: '1.2 PFLOPS' },
      { label: 'Memory', value: '192 GB HBM3e' },
      { label: 'Scrub', value: 'Every 90 s' },
    ],
    sections: [
      {
        title: 'Inference, not training',
        body: [
          'The node is tuned for prefill and decode: high memory bandwidth, low duty cycle, and a scheduler that can hand state to another satellite at any token boundary.',
          'Training stays on the ground. Checkpoints are uploaded once, validated, and preloaded before traffic is routed.',
        ],
        stats: [
          { label: 'Prefill', value: '4.1k tok/s' },
          { label: 'Decode', value: '780 tok/s' },
          { label: 'Context', value: '128k' },
        ],
      },
      {
        title: 'Fault-tolerant by default',
        body: [
          'ECC memory, scrubbed flash, and per-request isolation keep a single-event upset from becoming a tenant-visible failure.',
        ],
      },
    ],
    related: [
      { label: 'Radiation', to: '/platform/radiation' },
      { label: 'Runtime', to: '/platform/runtime' },
      { label: 'Models', to: '/models' },
    ],
  },
  {
    slug: 'power',
    title: 'Power without a permit',
    eyebrow: 'Platform / Power',
    summary:
      'A 42 kW deployable solar array, an 18 kWh buffer, and a power bus that keeps the accelerators inside their envelope.',
    meta: [
      { label: 'Solar', value: '42 kW' },
      { label: 'Buffer', value: '18 kWh' },
      { label: 'Bus', value: '120 V DC' },
    ],
    sections: [
      {
        title: 'Sun-synchronous by design',
        body: [
          'The 550 km sun-synchronous orbit keeps the array angle predictable and the eclipse window short. The battery buffer covers the pass and the handoff.',
        ],
        list: [
          'GaAs triple-junction cells',
          'Two independent array wings',
          'Battery-only eclipse mode',
          'Per-accelerator power gating',
        ],
      },
      {
        title: 'No interconnection queue',
        body: [
          'Orbital power is scheduled by launch, not by a utility. A new plane adds capacity without a substation, a water right, or a land lease.',
        ],
      },
    ],
    related: [
      { label: 'Thermal', to: '/platform/thermal' },
      { label: 'Hardware', to: '/platform/hardware' },
      { label: 'Why orbit', to: '/' },
    ],
  },
  {
    slug: 'thermal',
    title: 'Radiators pointed at 3 K',
    eyebrow: 'Platform / Thermal',
    summary:
      'A deployable ammonia loop rejects 38 kW into the vacuum, with no water and no cooling tower.',
    meta: [
      { label: 'Rejection', value: '38 kW' },
      { label: 'Loop', value: 'Ammonia' },
      { label: 'Radiator', value: 'Deployable' },
    ],
    sections: [
      {
        title: 'The vacuum is the coolant',
        body: [
          'Two deployable radiator panels reject heat by radiation alone. The loop is sized for the worst-case sun angle and the longest eclipse recovery.',
        ],
        stats: [
          { label: 'Radiator area', value: '31 m²' },
          { label: 'Loop ΔT', value: '18 °C' },
          { label: 'Recovery', value: '6 min' },
        ],
      },
      {
        title: 'No water, no tower',
        body: [
          'There is no evaporative cooling, no water treatment, and no plume. The thermal design is a closed loop with a known service life.',
        ],
      },
    ],
    related: [
      { label: 'Power', to: '/platform/power' },
      { label: 'Hardware', to: '/platform/hardware' },
      { label: 'Reliability', to: '/platform/reliability' },
    ],
  },
  {
    slug: 'radiation',
    title: 'Radiation is a scheduling problem',
    eyebrow: 'Platform / Radiation',
    summary:
      '300 krad tolerant components, ECC everywhere, and a runtime that can replay a request after an upset.',
    meta: [
      { label: 'Tolerance', value: '300 krad' },
      { label: 'Memory', value: 'ECC' },
      { label: 'Scrub', value: '90 s' },
    ],
    sections: [
      {
        title: 'Upsets are expected',
        body: [
          'Single-event upsets are normal in low Earth orbit. The design assumes they will happen and makes them invisible to the inference stream.',
        ],
        list: [
          'ECC on HBM and SRAM',
          'Scrubbed flash storage',
          'Watchdog reset domains',
          'Request replay from the ground cache',
        ],
      },
      {
        title: 'Tested in the chamber',
        body: [
          'Every flight unit runs 1,200 hours in thermal-vacuum with a radiation source before integration. A fault that cannot be reproduced does not fly.',
        ],
      },
    ],
    related: [
      { label: 'Compute', to: '/platform/compute' },
      { label: 'Reliability', to: '/platform/reliability' },
      { label: 'Security', to: '/platform/security' },
    ],
  },
  {
    slug: 'software',
    title: 'A thin stack over hard physics',
    eyebrow: 'Platform / Software',
    summary:
      'Signed flight software, a deterministic scheduler, and a ground control plane that never asks the satellite to improvise.',
    meta: [
      { label: 'Boot', value: 'Signed chain' },
      { label: 'Scheduler', value: 'Deterministic' },
      { label: 'Updates', value: 'Staged' },
    ],
    sections: [
      {
        title: 'Ground-tested, orbit-simple',
        body: [
          'The flight image is built, signed, and replayed in a hardware-in-the-loop lab before it is uploaded. The satellite never receives an unsigned command.',
        ],
        list: [
          'A/B flight images',
          'Signed command envelopes',
          'Deterministic inference scheduler',
          'Ground-side rollback',
        ],
      },
      {
        title: 'One API above the stack',
        body: [
          'Customers never see the flight software. They see an OpenAI-compatible endpoint and a usage record.',
        ],
      },
    ],
    related: [
      { label: 'Runtime', to: '/platform/runtime' },
      { label: 'Inference API', to: '/platform/runtime' },
      { label: 'Security', to: '/platform/security' },
    ],
  },
  {
    slug: 'runtime',
    title: 'The inference runtime',
    eyebrow: 'Platform / Runtime',
    summary:
      'Continuous batching, speculative decoding, and a handoff-aware KV cache that keeps a stream alive across satellites.',
    meta: [
      { label: 'Batching', value: 'Continuous' },
      { label: 'Cache', value: 'Handoff-aware' },
      { label: 'API', value: 'OpenAI-compatible' },
    ],
    sections: [
      {
        title: 'Prefill, decode, hand off',
        body: [
          'The scheduler treats a request as a sequence of recoverable segments. At T−90 seconds it mirrors the KV cache to the next node and drains the old one.',
        ],
        stats: [
          { label: 'Handoff', value: '90 s' },
          { label: 'State', value: '2.4 GB' },
          { label: 'Interruption', value: '0 ms' },
        ],
      },
      {
        title: 'No new SDK',
        body: [
          'Chat completions, streaming, tools, structured outputs, embeddings, and usage metadata share the same request shapes as the ground providers.',
        ],
      },
    ],
    related: [
      { label: 'API reference', to: '/docs/api/chat-completions' },
      { label: 'Streaming guide', to: '/docs/guides/streaming' },
      { label: 'Models', to: '/models' },
    ],
  },
  {
    slug: 'reliability',
    title: 'Designed for the horizon',
    eyebrow: 'Platform / Reliability',
    summary:
      'Handoffs before loss of signal, three ground paths to every metro, and a measured 99.98% commercial availability.',
    meta: [
      { label: 'Availability', value: '99.98%' },
      { label: 'Ground paths', value: 'N+2' },
      { label: 'Handoff', value: 'T−90 s' },
    ],
    sections: [
      {
        title: 'The horizon is scheduled',
        body: [
          'Orbit determination forecasts loss of signal to the second. The next node is selected, warmed, and mirrored before the current one goes dark.',
        ],
        list: [
          'State mirroring at T−90 s',
          'Three ground paths per metro',
          'Store-and-forward during eclipse',
          'SLA credits applied automatically',
        ],
      },
      {
        title: 'Measured, not promised',
        body: [
          'Availability is measured across commercial routes, including scheduled handoffs and planned ground-station maintenance.',
        ],
      },
    ],
    related: [
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Handoff', to: '/network/handoff' },
      { label: 'SLA', to: '/legal/sla' },
    ],
  },
  {
    slug: 'security',
    title: 'Guests, not residents',
    eyebrow: 'Platform / Security',
    summary:
      'Sealed boot, per-request memory isolation, ground-held keys, and no prompt persistence in orbit.',
    meta: [
      { label: 'Boot', value: 'Signed' },
      { label: 'Keys', value: 'Ground HSM' },
      { label: 'Retention', value: 'None' },
    ],
    sections: [
      {
        title: 'The data path',
        body: [
          'Prompts travel from a private ground relay to the node over an encrypted optical uplink. The node holds the request in HBM for the duration of the stream and discards the buffer after the response.',
        ],
        list: [
          'AES-256 optical uplink',
          'Per-request HBM isolation',
          'Ground-held customer keys',
          'Zero prompt retention in orbit',
        ],
      },
      {
        title: 'Audited like infrastructure',
        body: [
          'Annual penetration tests and flight-software reviews cover the ground segment, the uplink, and the node image. The audit report is available under NDA.',
        ],
      },
    ],
    related: [
      { label: 'Trust center', to: '/legal/trust-center' },
      { label: 'Data residency', to: '/resources/data-residency' },
      { label: 'DPA', to: '/legal/dpa' },
    ],
  },
  {
    slug: 'deployments',
    title: 'Three ways to orbit',
    eyebrow: 'Platform / Deployments',
    summary:
      'Shared nodes for speed, dedicated nodes for isolation, and sovereign satellites for the workloads that cannot share a ground segment.',
    meta: [
      { label: 'Shared', value: 'Per request' },
      { label: 'Dedicated', value: 'Whole node' },
      { label: 'Sovereign', value: 'Whole satellite' },
    ],
    sections: [
      {
        title: 'Start shared',
        body: [
          'Shared capacity uses per-request memory isolation and the same orbital mesh as every other tier. It is the fastest way to test a route.',
        ],
      },
      {
        title: 'Move when isolation matters',
        body: [
          'Dedicated nodes reserve the whole compute tray and KV cache. Sovereign deployments add a private ground segment and a named mission team.',
        ],
        list: [
          'Shared: per-request isolation',
          'Dedicated: whole node, 12-month commit',
          'Sovereign: whole satellite, 24-month commit',
        ],
      },
    ],
    related: [
      { label: 'Pricing', to: '/pricing' },
      { label: 'Dedicated plan', to: '/pricing/dedicated' },
      { label: 'Security', to: '/platform/security' },
    ],
  },
];

/**
 * Finds a platform sub-page by slug.
 * @param {string} slug
 * @returns {(typeof PLATFORM_PAGES)[number] | undefined}
 */
export function getPlatformPage(slug) {
  return PLATFORM_PAGES.find((page) => page.slug === slug);
}
