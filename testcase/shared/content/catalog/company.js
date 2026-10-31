import { JOBS, TEAM } from '../site.js';

/**
 * Converts a display name into a URL-safe slug.
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const TEAM_PAGES = TEAM.map((person) => ({
  slug: slugify(person.name),
  title: person.name,
  eyebrow: `Company / Team / ${person.role}`,
  summary: person.bio,
  meta: [
    { label: 'Role', value: person.role },
    { label: 'Initials', value: person.initials },
    { label: 'Location', value: person.name === 'Rosa Delgado' ? 'Svalbard' : 'Denver' },
  ],
  sections: [
    {
      title: 'At Aether',
      body: [
        person.bio,
        'The founding team has shipped orbital hardware, inference runtimes, and ground networks. Everyone still takes an anomaly call.',
      ],
    },
  ],
  related: [
    { label: 'Team', to: '/company/team' },
    { label: 'Careers', to: '/company/careers' },
    { label: 'Contact', to: '/company/contact' },
  ],
}));

const JOB_PAGES = JOBS.map((job) => ({
  slug: slugify(job.title),
  title: job.title,
  eyebrow: `Company / Careers / ${job.location}`,
  summary: `Aether is hiring a ${job.title.toLowerCase()} to work on the orbital inference network.`,
  meta: [
    { label: 'Location', value: job.location },
    { label: 'Type', value: job.type },
    { label: 'Team', value: 'Mission operations' },
  ],
  sections: [
    {
      title: 'What you will do',
      body: [
        'Own a piece of the ground-to-orbit path, from qualification and integration through on-call operations.',
        'Work with flight software, inference runtime, and ground-network engineers who are comfortable with hard deadlines and vacuum tests.',
      ],
      list: [
        'Design and review flight or ground changes',
        'Run hardware-in-the-loop and vacuum tests',
        'Take part in the 24/7 anomaly rotation',
        'Write the runbook before you need it',
      ],
    },
    {
      title: 'What we look for',
      body: [
        'Deep systems experience, calm incident judgement, and a preference for measured evidence over confident guesses.',
      ],
    },
  ],
  apply: {
    label: 'Apply by email',
    href: `mailto:careers@aethercompute.space?subject=${encodeURIComponent(job.subject)}`,
  },
  related: [
    { label: 'Careers', to: '/company/careers' },
    { label: 'Team', to: '/company/team' },
    { label: 'Contact', to: '/company/contact' },
  ],
}));

export const COMPANY_PAGES = [
  {
    slug: 'about',
    title: 'Small team. Long orbit.',
    eyebrow: 'Company / About',
    summary:
      'Aether is an AI infrastructure company that happens to be in space. The interface is an API; the product is latency and capacity.',
    meta: [
      { label: 'Founded', value: '2023 · Denver' },
      { label: 'Team', value: '38 people' },
      { label: 'Series B', value: '$84M' },
    ],
    sections: [
      {
        title: 'Why orbit',
        body: [
          'Terrestrial compute is running into interconnection queues, water rights, and land costs. Orbit inverts the constraint: solar is abundant, radiators point at 3 K, and capacity is scheduled by launch.',
          'We are not a space company that does AI. We are an AI infrastructure company that happens to be in space.',
        ],
      },
      {
        title: 'What we optimize',
        body: [
          'Latency, uptime, and a boring API. The physics is ours; the integration should feel like any other inference provider.',
        ],
        stats: [
          { label: 'Nodes', value: '6 active' },
          { label: 'Ground', value: '8 stations' },
          { label: 'Availability', value: '99.98%' },
        ],
      },
    ],
    related: [
      { label: 'Team', to: '/company/team' },
      { label: 'Careers', to: '/company/careers' },
      { label: 'Press', to: '/company/press' },
    ],
  },
  {
    slug: 'team',
    title: 'The founding team',
    eyebrow: 'Company / Team',
    summary: 'Four founders and thirty-four specialists across Denver, Svalbard, and Awarua.',
    widget: 'team-grid',
    sections: [
      {
        title: 'Built by operators',
        body: [
          'The team has shipped orbital hardware, inference runtimes, and ground networks. The founding group still reviews every flight change.',
        ],
      },
    ],
    related: [
      { label: 'Careers', to: '/company/careers' },
      { label: 'About', to: '/company/about' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  ...TEAM_PAGES,
  {
    slug: 'careers',
    title: 'Work where the horizon is a schedule',
    eyebrow: 'Company / Careers',
    summary: 'Open roles across orbital systems, inference runtime, and ground operations.',
    widget: 'jobs-list',
    sections: [
      {
        title: 'How we work',
        body: [
          'Hard deadlines, vacuum tests, and the occasional 04:00 UTC anomaly call. We write the runbook before we need it and review every flight change.',
        ],
      },
    ],
    related: [
      { label: 'Team', to: '/company/team' },
      { label: 'About', to: '/company/about' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  ...JOB_PAGES,
  {
    slug: 'press',
    title: 'For the record',
    eyebrow: 'Company / Press',
    summary: 'Launch imagery, executive interviews, and the press kit are available on request.',
    meta: [
      { label: 'Response', value: '1 business day' },
      { label: 'Press email', value: 'press@aethercompute.space' },
      { label: 'Assets', value: 'On request' },
    ],
    sections: [
      {
        title: 'Press contact',
        body: [
          'For launch imagery, executive interviews, and the press kit, email press@aethercompute.space. We answer press queries within one business day.',
        ],
      },
      {
        title: 'Boilerplate',
        body: [
          'Aether Compute operates a constellation of radiation-hardened GPU nodes in low Earth orbit and serves LLM inference over an optical mesh.',
        ],
      },
    ],
    related: [
      { label: 'About', to: '/company/about' },
      { label: 'Team', to: '/company/team' },
      { label: 'Contact', to: '/company/contact' },
    ],
  },
  {
    slug: 'contact',
    title: 'Open a channel',
    eyebrow: 'Company / Contact',
    summary:
      'Tell us your region, monthly token volume, and target date. We reply within two business days.',
    widget: 'contact-form',
    sections: [
      {
        title: 'What to include',
        body: [
          'Region, monthly token volume, context length, and whether you need a dedicated node or a private ground segment. If you are evaluating, tell us what you are comparing against.',
        ],
      },
    ],
    related: [
      { label: 'Capacity', to: '/pricing' },
      { label: 'Security', to: '/platform/security' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
];

/**
 * Finds a company sub-page by slug.
 * @param {string} slug
 * @returns {(typeof COMPANY_PAGES)[number] | undefined}
 */
export function getCompanyPage(slug) {
  return COMPANY_PAGES.find((page) => page.slug === slug);
}
