import { GROUND_STATIONS } from '../site.js';

const STATION_METADATA = {
  SVL: {
    summary:
      'The northern anchor of the network and the first station to acquire a commercial Aether pass.',
    antenna: '7.3 m Ka-band · 2 × 10 Gbps optical',
    since: '2025',
    highlight: 'Polar passes every 95 minutes',
  },
  AWA: {
    summary:
      'The southern anchor, covering the Pacific and providing the primary handoff corridor into Sydney.',
    antenna: '7.3 m Ka-band · 2 × 10 Gbps optical',
    since: '2025',
    highlight: 'Southern hemisphere failover',
  },
  PUQ: {
    summary:
      'A high-latitude South American station with a clean view of polar and mid-inclination passes.',
    antenna: '5.4 m Ka-band · 10 Gbps optical',
    since: '2025',
    highlight: 'Shortest path to São Paulo',
  },
  HNL: {
    summary:
      'The Pacific relay for Los Angeles traffic, with a dedicated fiber path to the mainland.',
    antenna: '5.4 m Ka-band · 10 Gbps optical',
    since: '2026',
    highlight: 'Pacific route diversity',
  },
  WAL: {
    summary: 'The first commercial ground station and the primary East Coast fiber handoff.',
    antenna: '7.3 m Ka-band · 2 × 10 Gbps optical',
    since: '2025',
    highlight: 'Lowest modeled latency to New York',
  },
  KOU: {
    summary: 'The equatorial station used for launch-window telemetry and South American coverage.',
    antenna: '5.4 m Ka-band · 10 Gbps optical',
    since: '2026',
    highlight: 'Equatorial launch support',
  },
  PER: {
    summary: 'The western Australian station covering Singapore and the Indian Ocean corridor.',
    antenna: '5.4 m Ka-band · 10 Gbps optical',
    since: '2026',
    highlight: 'Indian Ocean coverage',
  },
  MAD: {
    summary:
      'The European fiber hub, connecting the network to Frankfurt and the wider EU exchange fabric.',
    antenna: '5.4 m Ka-band · 10 Gbps optical',
    since: '2026',
    highlight: 'EU data-residency handoff',
  },
};

export const STATIONS = GROUND_STATIONS.map((station) => ({
  ...station,
  slug: station.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, ''),
  ...STATION_METADATA[station.code],
  status: 'Operational',
  uplink: '20 Gbps optical',
}));

/**
 * Finds a ground station by URL slug.
 * @param {string} slug
 * @returns {(typeof STATIONS)[number] | undefined}
 */
export function getStation(slug) {
  return STATIONS.find((station) => station.slug === slug);
}
