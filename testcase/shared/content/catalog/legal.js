export const LEGAL_PAGES = [
  {
    slug: 'privacy',
    title: 'Privacy policy',
    summary:
      'What the network processes, what it does not retain, and how to exercise a data-subject request.',
    updated: '2026-10-01',
    sections: [
      {
        title: 'What we process',
        body: [
          'Account data, workspace configuration, usage metadata, and the prompts and outputs you send to the inference API. Prompts are processed in orbit and discarded after the response.',
        ],
      },
      {
        title: 'What we retain',
        body: [
          'Usage records, request IDs, and billing data are retained for reconciliation. Prompt and output bodies are not retained in orbit.',
        ],
        list: [
          'Account and billing records',
          'Usage metadata',
          'Request IDs',
          'No prompt retention in orbit',
        ],
      },
      {
        title: 'Your rights',
        body: [
          'Contact privacy@aethercompute.space for access, correction, or erasure. We verify the request against the workspace owner before acting.',
        ],
      },
    ],
    related: [
      { label: 'DPA', to: '/legal/dpa' },
      { label: 'Subprocessors', to: '/legal/subprocessors' },
      { label: 'Trust center', to: '/legal/trust-center' },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    summary: 'The agreement that covers workspace access, acceptable use, and service commitments.',
    updated: '2026-10-01',
    sections: [
      {
        title: 'The service',
        body: [
          'Aether provides orbital inference capacity and the associated ground segment. The service is provided as described in the applicable order form and SLA.',
        ],
      },
      {
        title: 'Your responsibilities',
        body: [
          'You are responsible for the content you send, the models you deploy, and the validation of every output before it enters a production write path.',
        ],
      },
    ],
    related: [
      { label: 'Acceptable use', to: '/legal/acceptable-use' },
      { label: 'SLA', to: '/legal/sla' },
      { label: 'Privacy', to: '/legal/privacy' },
    ],
  },
  {
    slug: 'dpa',
    title: 'Data processing addendum',
    summary: 'The data-processing terms, regional routing boundaries, and subprocessor list.',
    updated: '2026-09-15',
    sections: [
      {
        title: 'Roles',
        body: [
          'For inference prompts, the customer is the controller and Aether is the processor. For account and billing data, Aether is the controller.',
        ],
      },
      {
        title: 'Routing boundary',
        body: [
          'Regional routing pins the ground segment. The DPA names the available boundaries and the subprocessors that operate each station.',
        ],
      },
    ],
    related: [
      { label: 'Subprocessors', to: '/legal/subprocessors' },
      { label: 'Data residency', to: '/resources/data-residency' },
      { label: 'Privacy', to: '/legal/privacy' },
    ],
  },
  {
    slug: 'sla',
    title: 'Service level agreement',
    summary: 'Availability targets, handoff exclusions, and the credit process.',
    updated: '2026-09-01',
    sections: [
      {
        title: 'Targets',
        body: [
          'Scale carries a 99.9% monthly availability target. Dedicated carries 99.99%. Scheduled maintenance and customer-caused failures are excluded.',
        ],
      },
      {
        title: 'Credits',
        body: [
          'Credits are applied automatically when a monthly target is missed. A handoff that completes without a client reconnect does not count as downtime.',
        ],
      },
    ],
    related: [
      { label: 'Status', to: '/resources/status' },
      { label: 'Incident history', to: '/resources/incident-history' },
      { label: 'Scale', to: '/pricing/scale' },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable use',
    summary: 'The limits on content, workloads, and network access.',
    updated: '2026-08-20',
    sections: [
      {
        title: 'Prohibited use',
        body: [
          'Do not use the network to violate law, infringe rights, distribute malware, or attempt to access another workspace. Do not probe the ground segment or the orbital mesh.',
        ],
      },
      {
        title: 'Enforcement',
        body: [
          'We may suspend a workspace that creates an immediate security or operational risk. We will explain the suspension and the remediation path.',
        ],
      },
    ],
    related: [
      { label: 'Terms', to: '/legal/terms' },
      { label: 'Security', to: '/platform/security' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie policy',
    summary: 'The small number of cookies this site uses, and why there is no advertising tracker.',
    updated: '2026-08-01',
    sections: [
      {
        title: 'Essential storage',
        body: [
          'This site uses local storage for preferences and the demo lab gate. There are no advertising cookies and no third-party analytics scripts.',
        ],
      },
      {
        title: 'Third-party assets',
        body: [
          'The site loads fonts from Google Fonts. The font request does not set an Aether cookie.',
        ],
      },
    ],
    related: [
      { label: 'Privacy', to: '/legal/privacy' },
      { label: 'Terms', to: '/legal/terms' },
      { label: 'Accessibility', to: '/legal/accessibility' },
    ],
  },
  {
    slug: 'subprocessors',
    title: 'Subprocessors',
    summary: 'The ground-segment operators, infrastructure providers, and their regions.',
    updated: '2026-09-15',
    sections: [
      {
        title: 'Current list',
        body: [
          'Subprocessors are listed by function and region. Ground-station operators are named per station; cloud and billing providers are listed at the service level.',
        ],
        list: [
          'Ground-segment operators',
          'Cloud infrastructure',
          'Billing and metering',
          'Email and support',
        ],
      },
      {
        title: 'Changes',
        body: [
          'We notify customers before adding a subprocessor that touches prompt data. The DPA describes the objection process.',
        ],
      },
    ],
    related: [
      { label: 'DPA', to: '/legal/dpa' },
      { label: 'Data residency', to: '/resources/data-residency' },
      { label: 'Trust center', to: '/legal/trust-center' },
    ],
  },
  {
    slug: 'trust-center',
    title: 'Trust center',
    summary: 'Security controls, audit status, and the documents available under NDA.',
    updated: '2026-10-05',
    sections: [
      {
        title: 'Controls',
        body: [
          'Signed boot, per-request isolation, ground-held keys, zero prompt retention, and annual penetration testing. The audit report is available under NDA.',
        ],
      },
      {
        title: 'Documents',
        body: [
          'DPA, SLA, subprocessor list, penetration-test summary, and the security questionnaire are available from the trust center on request.',
        ],
      },
    ],
    related: [
      { label: 'Security', to: '/platform/security' },
      { label: 'DPA', to: '/legal/dpa' },
      { label: 'SLA', to: '/legal/sla' },
    ],
  },
  {
    slug: 'accessibility',
    title: 'Accessibility',
    summary: 'The accessibility target for this site and how to report a barrier.',
    updated: '2026-08-01',
    sections: [
      {
        title: 'Target',
        body: [
          'This site targets WCAG 2.2 AA: keyboard navigation, visible focus, reduced-motion support, semantic landmarks, and labelled controls.',
        ],
      },
      {
        title: 'Report a barrier',
        body: [
          'Email accessibility@aethercompute.space with the page, the assistive technology, and what happened. We will confirm receipt and track the fix.',
        ],
      },
    ],
    related: [
      { label: 'Contact', to: '/company/contact' },
      { label: 'Support', to: '/resources/support' },
      { label: 'Privacy', to: '/legal/privacy' },
    ],
  },
];

/**
 * Finds a legal page by slug.
 * @param {string} slug
 * @returns {(typeof LEGAL_PAGES)[number] | undefined}
 */
export function getLegalPage(slug) {
  return LEGAL_PAGES.find((page) => page.slug === slug);
}
