export const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Platform', to: '/platform' },
  { label: 'Network', to: '/network' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Company', to: '/company' },
];

export const CONTACT = {
  general: 'hello@aethercompute.space',
  capacity: 'capacity@aethercompute.space',
  press: 'press@aethercompute.space',
  careers: 'careers@aethercompute.space',
  hq: 'Denver, Colorado, USA',
  groundOps: 'Ny-Ålesund, Svalbard, Norway',
};

export const SECTION_IDS = {
  api: 'api',
  security: 'security',
  constellation: 'constellation',
  groundSegment: 'ground-segment',
  telemetry: 'telemetry',
  careers: 'careers',
  press: 'press',
  contact: 'contact',
};

export const FOOTER_GROUPS = [
  {
    title: 'Platform',
    links: [
      { label: 'Overview', to: '/platform' },
      { label: 'Inference API', to: `/platform#${SECTION_IDS.api}` },
      { label: 'Security', to: `/platform#${SECTION_IDS.security}` },
      { label: 'Pricing', to: '/pricing' },
    ],
  },
  {
    title: 'Network',
    links: [
      { label: 'Constellation', to: `/network#${SECTION_IDS.constellation}` },
      { label: 'Ground stations', to: `/network#${SECTION_IDS.groundSegment}` },
      { label: 'Telemetry', to: `/network#${SECTION_IDS.telemetry}` },
      { label: 'Service status', to: `/network#${SECTION_IDS.telemetry}` },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/company' },
      { label: 'Careers', to: `/company#${SECTION_IDS.careers}` },
      { label: 'Press', to: `/company#${SECTION_IDS.press}` },
      { label: 'Contact', to: `/company#${SECTION_IDS.contact}` },
    ],
  },
];

export const HOME_METRICS = [
  { value: '06', label: 'Satellites on orbit' },
  { value: '1.2', unit: 'PFLOPS', label: 'FP8 per node' },
  { value: '18', unit: 'ms', label: 'P50 to London' },
  { value: '99.98', unit: '%', label: 'Network availability' },
];

export const NETWORK_METRICS = [
  { value: '24', label: 'Satellites planned' },
  { value: '06', label: 'Orbital planes' },
  { value: '08', label: 'Ground stations' },
  { value: '97.6', unit: '°', label: 'Orbital inclination' },
];

export const ORBIT_FEATURES = [
  {
    index: '01',
    title: 'Power without a permit',
    copy: 'Orbital solar is not interrupted by weather or constrained by an interconnection queue. Each node draws 42 kW and answers to the sun.',
    data: '42 kW / node',
  },
  {
    index: '02',
    title: 'Latency without the trench',
    copy: 'Fiber follows land, and land is slow. Optical crosslinks take the great-circle path at 300 kilometres per millisecond.',
    data: '300 km / ms',
  },
  {
    index: '03',
    title: 'Capacity without concrete',
    copy: 'Scale by adding satellites, not by waiting three years for a substation. A new plane enters service on a 90-day cadence.',
    data: '90 days / launch',
  },
];

export const LATENCY_ROUTES = [
  { id: 'svl-lon', from: 'Svalbard', to: 'London', orbital: 18, fiber: 31 },
  { id: 'kou-mia', from: 'Kourou', to: 'Miami', orbital: 21, fiber: 46 },
  { id: 'hnl-lax', from: 'Hawaii', to: 'Los Angeles', orbital: 24, fiber: 41 },
  { id: 'puq-sao', from: 'Punta Arenas', to: 'São Paulo', orbital: 22, fiber: 58 },
  { id: 'per-sin', from: 'Perth', to: 'Singapore', orbital: 19, fiber: 42 },
];

export const GROUND_STATIONS = [
  {
    code: 'SVL',
    name: 'Svalbard',
    location: 'Ny-Ålesund, Norway',
    coordinates: '78.23°N 15.39°E',
    metro: 'London',
    latency: 18,
  },
  {
    code: 'AWA',
    name: 'Awarua',
    location: 'Awarua, New Zealand',
    coordinates: '46.53°S 168.38°E',
    metro: 'Sydney',
    latency: 27,
  },
  {
    code: 'PUQ',
    name: 'Punta Arenas',
    location: 'Magallanes, Chile',
    coordinates: '53.16°S 70.92°W',
    metro: 'São Paulo',
    latency: 22,
  },
  {
    code: 'HNL',
    name: 'Hawaii',
    location: 'Oahu, United States',
    coordinates: '21.31°N 157.86°W',
    metro: 'Los Angeles',
    latency: 24,
  },
  {
    code: 'WAL',
    name: 'Wallops',
    location: 'Virginia, United States',
    coordinates: '37.94°N 75.47°W',
    metro: 'New York',
    latency: 16,
  },
  {
    code: 'KOU',
    name: 'Kourou',
    location: 'French Guiana',
    coordinates: '5.16°N 52.65°W',
    metro: 'Miami',
    latency: 21,
  },
  {
    code: 'PER',
    name: 'Perth',
    location: 'Western Australia',
    coordinates: '31.95°S 115.86°E',
    metro: 'Singapore',
    latency: 19,
  },
  {
    code: 'MAD',
    name: 'Madrid',
    location: 'Community of Madrid, Spain',
    coordinates: '40.42°N 3.70°W',
    metro: 'Frankfurt',
    latency: 14,
  },
];

export const SATELLITES = [
  {
    id: 'AETHER-01',
    plane: 'P1',
    status: 'Nominal',
    utilization: 74,
    radiator: '21.4 °C',
    link: '9.7 Gbps',
  },
  {
    id: 'AETHER-02',
    plane: 'P1',
    status: 'Handoff',
    utilization: 88,
    radiator: '23.1 °C',
    link: '9.4 Gbps',
  },
  {
    id: 'AETHER-03',
    plane: 'P2',
    status: 'Nominal',
    utilization: 61,
    radiator: '19.8 °C',
    link: '9.9 Gbps',
  },
  {
    id: 'AETHER-04',
    plane: 'P3',
    status: 'Eclipse',
    utilization: 42,
    radiator: '17.2 °C',
    link: 'Battery',
  },
  {
    id: 'AETHER-05',
    plane: 'P4',
    status: 'Nominal',
    utilization: 79,
    radiator: '22.6 °C',
    link: '9.6 Gbps',
  },
  {
    id: 'AETHER-06',
    plane: 'P5',
    status: 'Handoff',
    utilization: 91,
    radiator: '24.0 °C',
    link: '9.2 Gbps',
  },
];

export const CUSTOMER_LOGOS = ['MERIDIAN AI', 'NORTHSTAR LABS', 'HELIX RESEARCH', 'PARALLAX'];

export const COMPANY_TIMELINE = [
  {
    year: '2023 / Q2',
    title: 'Founded in Denver',
    copy: 'Three engineers, one radiation test chamber, and a conviction that compute should leave the atmosphere.',
    status: 'Complete',
  },
  {
    year: '2024 / Q4',
    title: 'Ground demonstration',
    copy: 'A full inference node runs 1,200 hours in a thermal-vacuum chamber with zero uncorrected memory faults.',
    status: 'Complete',
  },
  {
    year: '2025 / Q3',
    title: 'Aether-1 and Aether-2 launch',
    copy: 'The first commercial tokens are served from 550 kilometres. The ground segment opens with three stations.',
    status: 'Complete',
  },
  {
    year: '2026 / Q2',
    title: 'Commercial service opens',
    copy: 'Six satellites, eight ground stations, and 99.98% measured availability across commercial routes.',
    status: 'Operational',
    current: true,
  },
  {
    year: '2027 / H1',
    title: 'Full constellation',
    copy: 'Twenty-four satellites in six planes deliver continuous coverage from 60°N to 55°S.',
    status: 'In build',
  },
  {
    year: '2028',
    title: 'Cis-lunar relay study',
    copy: 'A 3,000-kilometre optical link for research partners operating beyond low Earth orbit.',
    status: 'Study',
  },
];

export const TEAM = [
  {
    initials: 'EV',
    name: 'Elena Voss',
    role: 'Co-founder & CEO',
    bio: 'Spent twelve years building orbital infrastructure programs. Believes latency is a design choice.',
  },
  {
    initials: 'AM',
    name: 'Dr. Arun Mehta',
    role: 'Co-founder & CTO',
    bio: 'Radiation-hardened compute researcher. Built the first fault-tolerant inference node tested in vacuum.',
  },
  {
    initials: 'RD',
    name: 'Rosa Delgado',
    role: 'VP, Space Operations',
    bio: 'Former launch director with forty missions behind her. Keeps the constellation on time and out of debris.',
  },
  {
    initials: 'JB',
    name: 'Jonas Berg',
    role: 'VP, Ground Network',
    bio: 'Satcom and fiber veteran. Negotiated every one of our eight ground stations, often in person.',
  },
];

export const INVESTORS = [
  'NORTHLINE VENTURES',
  'APOGEE CAPITAL',
  'KEPLER STRATEGIC',
  'HALO PARTNERS',
];

export const JOBS = [
  {
    title: 'Orbital Systems Engineer',
    location: 'Denver, CO',
    type: 'Full-time',
    subject: 'Orbital Systems Engineer',
  },
  {
    title: 'Inference Runtime Engineer',
    location: 'Remote, US',
    type: 'Full-time',
    subject: 'Inference Runtime Engineer',
  },
  {
    title: 'Ground Network Operator',
    location: 'Svalbard, Norway',
    type: 'Full-time',
    subject: 'Ground Network Operator',
  },
];
