export const REGIONS = [
  {
    slug: 'north-america',
    title: 'North America',
    summary:
      'Wallops and Hawaii anchor the East Coast and Pacific routes, with the lowest modeled latency to New York.',
    meta: [
      { label: 'Stations', value: '2' },
      { label: 'Best p50', value: '16 ms' },
      { label: 'Metros', value: 'New York · LA' },
    ],
    sections: [
      {
        title: 'Ground segment',
        body: [
          'Wallops handles the East Coast fiber handoff; Hawaii covers the Pacific and provides route diversity for Los Angeles traffic.',
        ],
      },
      {
        title: 'Residency',
        body: [
          'Regional routing keeps US traffic inside the US ground segment. Dedicated deployments can pin a private relay.',
        ],
      },
    ],
    related: [
      { label: 'Wallops', to: '/network/ground-stations/wallops' },
      { label: 'Hawaii', to: '/network/ground-stations/hawaii' },
      { label: 'Routes', to: '/network/routes' },
    ],
  },
  {
    slug: 'south-america',
    title: 'South America',
    summary: 'Punta Arenas and Kourou cover the southern cone and the equatorial Atlantic.',
    meta: [
      { label: 'Stations', value: '2' },
      { label: 'Best p50', value: '21 ms' },
      { label: 'Metros', value: 'São Paulo · Miami' },
    ],
    sections: [
      {
        title: 'Ground segment',
        body: [
          'Punta Arenas provides a high-latitude view and the shortest modeled path to São Paulo. Kourou covers the equatorial Atlantic and launch-window telemetry.',
        ],
      },
      {
        title: 'Coverage',
        body: [
          'The two stations give the region route diversity without a long terrestrial haul to the northern hemisphere.',
        ],
      },
    ],
    related: [
      { label: 'Punta Arenas', to: '/network/ground-stations/punta-arenas' },
      { label: 'Kourou', to: '/network/ground-stations/kourou' },
      { label: 'Routes', to: '/network/routes' },
    ],
  },
  {
    slug: 'europe',
    title: 'Europe',
    summary: 'Svalbard and Madrid connect the Arctic passes to the EU exchange fabric.',
    meta: [
      { label: 'Stations', value: '2' },
      { label: 'Best p50', value: '14 ms' },
      { label: 'Metros', value: 'London · Frankfurt' },
    ],
    sections: [
      {
        title: 'Ground segment',
        body: [
          'Svalbard acquires polar passes and hands traffic to London. Madrid provides the EU fiber handoff and regional residency boundary.',
        ],
      },
      {
        title: 'Residency',
        body: [
          'EU traffic can be pinned to Madrid and the Frankfurt exchange for a named data boundary.',
        ],
      },
    ],
    related: [
      { label: 'Svalbard', to: '/network/ground-stations/svalbard' },
      { label: 'Madrid', to: '/network/ground-stations/madrid' },
      { label: 'Data residency', to: '/resources/data-residency' },
    ],
  },
  {
    slug: 'africa',
    title: 'Africa',
    summary:
      'Atlantic and Indian Ocean passes connect through the European and Middle East relays.',
    meta: [
      { label: 'Stations', value: 'Via relay' },
      { label: 'Best p50', value: '28 ms' },
      { label: 'Metros', value: 'Lagos · Nairobi' },
    ],
    sections: [
      {
        title: 'Coverage model',
        body: [
          'African traffic routes through Madrid, Kourou, and the Middle East relay until a dedicated station is online. The route map names the actual handoff.',
        ],
      },
      {
        title: 'Expansion',
        body: [
          'A Nairobi ground station is in the 2027 integration plan. The station will shorten the East African path and add route diversity.',
        ],
      },
    ],
    related: [
      { label: 'Madrid', to: '/network/ground-stations/madrid' },
      { label: 'Kourou', to: '/network/ground-stations/kourou' },
      { label: 'Network', to: '/network/constellation' },
    ],
  },
  {
    slug: 'middle-east',
    title: 'Middle East',
    summary: 'Routes through Madrid and the Indian Ocean relay, with a planned regional station.',
    meta: [
      { label: 'Stations', value: 'Via relay' },
      { label: 'Best p50', value: '26 ms' },
      { label: 'Metros', value: 'Dubai · Riyadh' },
    ],
    sections: [
      {
        title: 'Coverage model',
        body: [
          'Traffic routes through Madrid and Perth until the regional station enters service. The network page shows the modeled p50 for each metro.',
        ],
      },
      {
        title: 'Residency',
        body: [
          'Sovereign deployments can add a private ground segment in the region. Shared traffic remains on the named relay path.',
        ],
      },
    ],
    related: [
      { label: 'Madrid', to: '/network/ground-stations/madrid' },
      { label: 'Perth', to: '/network/ground-stations/perth' },
      { label: 'Routes', to: '/network/routes' },
    ],
  },
  {
    slug: 'asia-pacific',
    title: 'Asia-Pacific',
    summary: 'Perth, Awarua, and Hawaii cover the Indian Ocean, Oceania, and the Pacific corridor.',
    meta: [
      { label: 'Stations', value: '3' },
      { label: 'Best p50', value: '19 ms' },
      { label: 'Metros', value: 'Singapore · Sydney' },
    ],
    sections: [
      {
        title: 'Ground segment',
        body: [
          'Perth serves Singapore and the Indian Ocean. Awarua covers Sydney and the southern Pacific. Hawaii adds the northern Pacific handoff.',
        ],
      },
      {
        title: 'Route diversity',
        body: [
          'The three stations give APAC traffic more than one path to the orbital mesh, even during a planned station outage.',
        ],
      },
    ],
    related: [
      { label: 'Perth', to: '/network/ground-stations/perth' },
      { label: 'Awarua', to: '/network/ground-stations/awarua' },
      { label: 'Routes', to: '/network/routes' },
    ],
  },
  {
    slug: 'oceania',
    title: 'Oceania',
    summary: 'Awarua and Perth provide the southern and western anchors for the Pacific.',
    meta: [
      { label: 'Stations', value: '2' },
      { label: 'Best p50', value: '27 ms' },
      { label: 'Metros', value: 'Sydney · Auckland' },
    ],
    sections: [
      {
        title: 'Ground segment',
        body: [
          'Awarua is the primary southern relay; Perth covers the western edge and provides a second path into the Indian Ocean.',
        ],
      },
      {
        title: 'Weather',
        body: [
          'Both stations are designed for remote operations, with redundant power and a fiber path that does not depend on a single exchange.',
        ],
      },
    ],
    related: [
      { label: 'Awarua', to: '/network/ground-stations/awarua' },
      { label: 'Perth', to: '/network/ground-stations/perth' },
      { label: 'Network', to: '/network/constellation' },
    ],
  },
  {
    slug: 'arctic',
    title: 'Arctic',
    summary: 'Svalbard acquires the polar passes that make the sun-synchronous orbit useful.',
    meta: [
      { label: 'Station', value: 'Svalbard' },
      { label: 'Latitude', value: '78.23°N' },
      { label: 'Passes', value: 'Every 95 min' },
    ],
    sections: [
      {
        title: 'The northern anchor',
        body: [
          'Svalbard sees every orbital plane and hands traffic to London over a short fiber path. It is the first station to acquire a commercial Aether pass.',
        ],
      },
      {
        title: 'Remote operations',
        body: [
          'The station runs with a small on-site team and a remote operations overlay. Power and fiber are redundant.',
        ],
      },
    ],
    related: [
      { label: 'Svalbard', to: '/network/ground-stations/svalbard' },
      { label: 'Europe', to: '/regions/europe' },
      { label: 'Constellation', to: '/network/constellation' },
    ],
  },
  {
    slug: 'antarctic',
    title: 'Antarctic',
    summary:
      'Southern polar coverage through Punta Arenas and Awarua, with no permanent station on the ice.',
    meta: [
      { label: 'Stations', value: 'Via relay' },
      { label: 'Best p50', value: '34 ms' },
      { label: 'Metros', value: 'Research links' },
    ],
    sections: [
      {
        title: 'Coverage model',
        body: [
          'Antarctic traffic routes through Punta Arenas and Awarua. There is no permanent Aether station on the continent; the relay path is named in the route map.',
        ],
      },
      {
        title: 'Research access',
        body: [
          'Research stations can use Academic capacity with a store-and-forward profile for links that are intermittent.',
        ],
      },
    ],
    related: [
      { label: 'Punta Arenas', to: '/network/ground-stations/punta-arenas' },
      { label: 'Awarua', to: '/network/ground-stations/awarua' },
      { label: 'Academic', to: '/pricing/academic' },
    ],
  },
];

/**
 * Finds a region page by slug.
 * @param {string} slug
 * @returns {(typeof REGIONS)[number] | undefined}
 */
export function getRegion(slug) {
  return REGIONS.find((region) => region.slug === slug);
}
