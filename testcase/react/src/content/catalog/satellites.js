import { SATELLITES as ACTIVE_TELEMETRY } from '../site.js';

const ACTIVE_METADATA = {
  'AETHER-01': {
    launch: '2025-09-14',
    summary:
      'The first commercial inference node, qualified over Svalbard and now serving European routes.',
    milestone: 'First token served from orbit',
  },
  'AETHER-02': {
    launch: '2025-09-14',
    summary:
      'The second node in plane P1, used for handoff rehearsals and priority European traffic.',
    milestone: 'First live optical handoff',
  },
  'AETHER-03': {
    launch: '2026-01-22',
    summary:
      'A P2 node carrying the first production 128k-context runtime and the new radiator loop.',
    milestone: 'First 128k context request',
  },
  'AETHER-04': {
    launch: '2026-01-22',
    summary:
      'The eclipse-test node, instrumented to validate battery buffering and thermal recovery.',
    milestone: 'Longest eclipse soak',
  },
  'AETHER-05': {
    launch: '2026-04-03',
    summary:
      'A P4 node focused on Pacific routes and the first deployment of the 20 Gbps terminal pair.',
    milestone: 'First 20 Gbps optical link',
  },
  'AETHER-06': {
    launch: '2026-04-03',
    summary: 'The highest-utilization node in the current constellation, serving APAC handoffs.',
    milestone: 'Highest sustained node load',
  },
};

const ACTIVE = ACTIVE_TELEMETRY.map((satellite) => {
  const metadata = ACTIVE_METADATA[satellite.id];
  return {
    ...satellite,
    slug: satellite.id.toLowerCase(),
    name: satellite.id,
    launch: metadata.launch,
    summary: metadata.summary,
    milestone: metadata.milestone,
    orbit: '550 km SSO',
    inclination: '97.6°',
    mass: '1,840 kg',
    payload: '8 × tensor accelerators',
    vehicle: 'Falcon 9 rideshare',
    telemetry: true,
  };
});

const PLANNED_STATUSES = ['Integration', 'Manifest', 'Planned'];
const PLANNED = Array.from({ length: 18 }, (_, index) => {
  const number = index + 7;
  const id = `AETHER-${String(number).padStart(2, '0')}`;
  const name = `Aether-${String(number).padStart(2, '0')}`;
  const plane = `P${((index + 2) % 6) + 1}`;
  const status = PLANNED_STATUSES[index % PLANNED_STATUSES.length];
  return {
    id,
    slug: id.toLowerCase(),
    name,
    plane,
    status,
    launch: `2027-${String((index % 9) + 1).padStart(2, '0')}-${String((index % 20) + 5).padStart(2, '0')}`,
    summary: `${name} is a planned ${plane} node in the 24-satellite build-out. ${status === 'Integration' ? 'Flight hardware is in the clean room.' : status === 'Manifest' ? 'Assigned to a launch window and awaiting integration.' : 'Reserved for the second 2027 launch block.'}`,
    milestone: status === 'Integration' ? 'Thermal-vacuum test scheduled' : 'Launch slot reserved',
    orbit: '550 km SSO',
    inclination: '97.6°',
    mass: '1,840 kg',
    payload: '8 × tensor accelerators',
    vehicle: 'Medium-lift rideshare',
    utilization: null,
    radiator: '—',
    link: '—',
    telemetry: false,
  };
});

export const SATELLITES = [...ACTIVE, ...PLANNED];

/**
 * Finds a satellite by its URL slug.
 * @param {string} slug
 * @returns {(typeof SATELLITES)[number] | undefined}
 */
export function getSatellite(slug) {
  return SATELLITES.find((satellite) => satellite.slug === slug);
}
