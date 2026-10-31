const GUIDES = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    summary: 'Send your first request to the orbital inference API in under five minutes.',
    updated: '2026-10-18',
    code: `curl https://orbit.aethercompute.space/v1/chat/completions \\
  -H "Authorization: Bearer $AETHER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "aether-70b-instruct",
    "messages": [{ "role": "user", "content": "Hello from the ground." }]
  }'`,
    sections: [
      {
        title: 'Create a key',
        body: [
          'Create an API key in the console and export it as AETHER_API_KEY. Keys are scoped to a workspace and can be rotated without changing the endpoint.',
        ],
      },
      {
        title: 'Point your client at orbit',
        body: [
          'The base URL is https://orbit.aethercompute.space/v1. Any OpenAI-compatible client works; regional routing is automatic.',
        ],
      },
      {
        title: 'Read the response',
        body: [
          'Responses include usage metadata, the selected region, and the satellite that served the request. Streaming uses the same event shape as the ground providers.',
        ],
      },
    ],
    related: [
      { label: 'Authentication', to: '/docs/guides/authentication' },
      { label: 'Streaming', to: '/docs/guides/streaming' },
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
    ],
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    summary: 'Workspace keys, scoped tokens, rotation, and the headers every request needs.',
    updated: '2026-10-10',
    sections: [
      {
        title: 'Bearer tokens',
        body: [
          'Every request carries an Authorization: Bearer header. Keys are created per workspace and can be scoped to inference, embeddings, or usage reads.',
        ],
      },
      {
        title: 'Rotation',
        body: [
          'Rotate keys from the console. The previous key remains valid for a short grace period so long-lived clients can drain without a failed request.',
        ],
        list: [
          'Workspace-scoped keys',
          'Optional read-only usage scope',
          'Rotation with grace period',
          'No keys in query strings',
        ],
      },
    ],
    related: [
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Errors', to: '/docs/guides/errors' },
      { label: 'Security', to: '/platform/security' },
    ],
  },
  {
    slug: 'streaming',
    title: 'Streaming',
    summary: 'Server-sent events, token deltas, and how to keep a stream alive across a handoff.',
    updated: '2026-10-08',
    code: `const stream = await client.chat.completions.create({
  model: 'aether-70b-instruct',
  messages,
  stream: true,
});

for await (const event of stream) {
  process.stdout.write(event.choices[0]?.delta?.content ?? '');
}`,
    sections: [
      {
        title: 'Event shape',
        body: [
          'Streaming responses use server-sent events with a data: JSON payload. The final event carries usage and the serving node.',
        ],
      },
      {
        title: 'Handoffs are invisible',
        body: [
          'At T−90 seconds the runtime mirrors the KV cache to the next node. The client keeps the same request ID and event stream.',
        ],
      },
    ],
    related: [
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
      { label: 'Handoff', to: '/network/handoff' },
      { label: 'JavaScript SDK', to: '/docs/sdk/javascript' },
    ],
  },
  {
    slug: 'tools',
    title: 'Tool calling',
    summary:
      'Declare tools, receive structured calls, and return results without leaving the stream.',
    updated: '2026-09-30',
    sections: [
      {
        title: 'Declare a tool',
        body: [
          'Pass tools as JSON schema. The model returns a tool call with an id, a name, and a JSON argument string.',
        ],
      },
      {
        title: 'Return the result',
        body: [
          'Append a tool message with the matching id and continue the conversation. Tool calls can be streamed like ordinary tokens.',
        ],
      },
    ],
    related: [
      { label: 'Structured outputs', to: '/docs/guides/structured-outputs' },
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
  {
    slug: 'structured-outputs',
    title: 'Structured outputs',
    summary: 'Constrain a response to a JSON schema and validate it on the ground.',
    updated: '2026-09-22',
    sections: [
      {
        title: 'Schema mode',
        body: [
          'Set response_format to json_schema and provide a schema. The runtime constrains decoding, so the response is valid JSON before it leaves the node.',
        ],
      },
      {
        title: 'Validate anyway',
        body: [
          'Treat the response as untrusted input. Validate it against the same schema on the ground before using it in a write path.',
        ],
      },
    ],
    related: [
      { label: 'Tool calling', to: '/docs/guides/tools' },
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
  {
    slug: 'embeddings',
    title: 'Embeddings',
    summary: 'Batch embeddings, dimensions, and regional routing for retrieval workloads.',
    updated: '2026-09-15',
    sections: [
      {
        title: 'Batch by default',
        body: [
          'Send up to 256 inputs per request. The endpoint returns one vector per input with usage metadata.',
        ],
      },
      {
        title: 'Dimensions',
        body: [
          'The aether-embed model supports 1024 and 3072 dimensions. Choose one at request time; do not mix dimensions in one index.',
        ],
      },
    ],
    related: [
      { label: 'Embeddings API', to: '/docs/api/embeddings' },
      { label: 'Models', to: '/models/aether-embed' },
      { label: 'Usage', to: '/docs/api/usage' },
    ],
  },
  {
    slug: 'errors',
    title: 'Errors and retries',
    summary:
      'Status codes, machine-readable error codes, and the retry policy that respects handoffs.',
    updated: '2026-09-08',
    sections: [
      {
        title: 'Error shape',
        body: [
          'Every error returns success: false, a human-readable message, a machine-readable code, and optional field details.',
        ],
        list: [
          '401 unauthenticated',
          '403 unauthorised',
          '422 validation failure',
          '429 rate limited',
          '503 regional capacity',
        ],
      },
      {
        title: 'Retry with jitter',
        body: [
          'Retry 429 and 503 with exponential backoff and jitter. Do not retry 422; fix the request. Handoffs should not surface as errors.',
        ],
      },
    ],
    related: [
      { label: 'Rate limits', to: '/docs/api/usage' },
      { label: 'Authentication', to: '/docs/guides/authentication' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
  {
    slug: 'migration',
    title: 'Migration guide',
    summary: 'Move an existing OpenAI-compatible workload to orbit with a base URL and a key.',
    updated: '2026-08-28',
    sections: [
      {
        title: 'Change two values',
        body: [
          'Most workloads only change the base URL and the API key. Model names map to Aether-hosted equivalents; check the model catalog before switching.',
        ],
      },
      {
        title: 'Run a shadow route',
        body: [
          'Send a percentage of traffic to orbit and compare p50, p95, and error rates. Keep the ground route warm until the orbital route is inside your SLO.',
        ],
      },
    ],
    related: [
      { label: 'Models', to: '/models' },
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Compare', to: '/pricing/compare' },
    ],
  },
];

const API_REFERENCES = [
  {
    slug: 'chat-completions',
    title: 'Chat completions',
    summary: 'POST /v1/chat/completions — messages, tools, streaming, and structured outputs.',
    updated: '2026-10-20',
    sections: [
      {
        title: 'Request',
        body: [
          'The request accepts model, messages, temperature, max_tokens, stream, tools, tool_choice, and response_format. Unknown fields are rejected with 422.',
        ],
        code: `{
  "model": "aether-70b-instruct",
  "messages": [{ "role": "user", "content": "..." }],
  "stream": false
}`,
      },
      {
        title: 'Response',
        body: [
          'The response includes id, model, choices, usage, and aether metadata with the serving node and region.',
        ],
      },
    ],
    related: [
      { label: 'Streaming', to: '/docs/guides/streaming' },
      { label: 'Tool calling', to: '/docs/guides/tools' },
      { label: 'Models', to: '/models' },
    ],
  },
  {
    slug: 'models',
    title: 'Models API',
    summary: 'GET /v1/models — list available models, context windows, and regional availability.',
    updated: '2026-10-12',
    sections: [
      {
        title: 'List models',
        body: [
          'Returns the hosted model catalog with context length, modality, and the regions where the model is currently routed.',
        ],
      },
      {
        title: 'Model aliases',
        body: [
          'Aliases point at the current recommended checkpoint. Pin a dated checkpoint when reproducibility matters.',
        ],
      },
    ],
    related: [
      { label: 'Model catalog', to: '/models' },
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
      { label: 'Deprecated', to: '/models/deprecated' },
    ],
  },
  {
    slug: 'embeddings',
    title: 'Embeddings API',
    summary: 'POST /v1/embeddings — batch vectors with dimensions and usage metadata.',
    updated: '2026-09-25',
    sections: [
      {
        title: 'Request',
        body: [
          'Send input as a string or an array of strings, choose a model and dimensions, and optionally request base64 encoding.',
        ],
      },
      {
        title: 'Limits',
        body: [
          'Up to 256 inputs per request and 8,192 tokens per input. The response preserves input order.',
        ],
      },
    ],
    related: [
      { label: 'Embeddings guide', to: '/docs/guides/embeddings' },
      { label: 'aether-embed', to: '/models/aether-embed' },
      { label: 'Usage', to: '/docs/api/usage' },
    ],
  },
  {
    slug: 'usage',
    title: 'Usage API',
    summary: 'GET /v1/usage — token totals, request counts, and per-region breakdowns.',
    updated: '2026-09-18',
    sections: [
      {
        title: 'Query usage',
        body: [
          'Filter by workspace, model, region, and time window. Usage is metered per request and aggregated in UTC.',
        ],
      },
      {
        title: 'Reconciliation',
        body: [
          'Usage records include request IDs so a billing line can be traced back to a specific response.',
        ],
      },
    ],
    related: [
      { label: 'Pricing', to: '/pricing' },
      { label: 'Estimator', to: '/pricing/estimator' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
  {
    slug: 'webhooks',
    title: 'Webhooks',
    summary: 'Signed events for handoffs, capacity changes, and usage thresholds.',
    updated: '2026-09-10',
    sections: [
      {
        title: 'Verify the signature',
        body: [
          'Every webhook includes an HMAC-SHA256 signature over the raw body. Reject missing or invalid signatures before parsing the event.',
        ],
      },
      {
        title: 'Event types',
        body: [
          'Events cover handoff completion, regional capacity changes, and usage threshold crossings. Delivery is at-least-once; deduplicate by event id.',
        ],
      },
    ],
    related: [
      { label: 'Security', to: '/platform/security' },
      { label: 'Usage', to: '/docs/api/usage' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
];

const SDKS = [
  {
    slug: 'javascript',
    title: 'JavaScript SDK',
    summary: 'The official Node and browser client with streaming, tools, and typed errors.',
    updated: '2026-10-05',
    code: `import { Aether } from '@aether/sdk';

const aether = new Aether({ apiKey: process.env.AETHER_API_KEY });
const response = await aether.chat.completions.create({
  model: 'aether-70b-instruct',
  messages: [{ role: 'user', content: 'Hello from the ground.' }],
});`,
    sections: [
      {
        title: 'Install',
        body: [
          'Install @aether/sdk with npm, pnpm, or yarn. The package is ESM-first and ships types.',
        ],
      },
      {
        title: 'Errors',
        body: [
          'The SDK throws typed errors with code, status, and requestId. Retryable errors expose a retry helper.',
        ],
      },
    ],
    related: [
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Streaming', to: '/docs/guides/streaming' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
  {
    slug: 'python',
    title: 'Python SDK',
    summary: 'Sync and async clients with streaming iterators and structured output helpers.',
    updated: '2026-09-29',
    code: `from aether import Aether

client = Aether(api_key=os.environ["AETHER_API_KEY"])
response = client.chat.completions.create(
    model="aether-70b-instruct",
    messages=[{"role": "user", "content": "Hello from the ground."}],
)`,
    sections: [
      {
        title: 'Install',
        body: ['Install aether-sdk with pip. Python 3.10+ is required for the async client.'],
      },
      {
        title: 'Async',
        body: [
          'Use AsyncAether for asyncio workloads. Streaming returns an async iterator of deltas.',
        ],
      },
    ],
    related: [
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Streaming', to: '/docs/guides/streaming' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
  {
    slug: 'go',
    title: 'Go SDK',
    summary: 'A small client with context cancellation, streaming channels, and typed errors.',
    updated: '2026-09-20',
    code: `client := aether.NewClient(os.Getenv("AETHER_API_KEY"))
resp, err := client.Chat.Completions.Create(ctx, aether.ChatRequest{
    Model: "aether-70b-instruct",
    Messages: []aether.Message{{Role: "user", Content: "Hello from the ground."}},
})`,
    sections: [
      {
        title: 'Install',
        body: [
          'Import github.com/aethercompute/aether-go. The client is context-first and safe for concurrent use.',
        ],
      },
      {
        title: 'Streaming',
        body: [
          'Streaming returns a channel of deltas and a terminal error channel. Cancel the context to stop decoding.',
        ],
      },
    ],
    related: [
      { label: 'Quickstart', to: '/docs/guides/quickstart' },
      { label: 'Streaming', to: '/docs/guides/streaming' },
      { label: 'Errors', to: '/docs/guides/errors' },
    ],
  },
];

const CHANGELOG = [
  {
    slug: '2026-10',
    title: 'October 2026',
    summary: '128k context on Scale, route palette, and a new handoff trace.',
    bullets: [
      '128k context is now default on Scale.',
      'Route palette ships with 200 pages.',
      'Handoff traces expose T−90 state mirroring.',
    ],
  },
  {
    slug: '2026-09',
    title: 'September 2026',
    summary: 'Structured outputs, webhook signatures, and Madrid goes live.',
    bullets: [
      'Structured outputs leave beta.',
      'Webhook HMAC verification documented.',
      'Madrid ground station enters service.',
    ],
  },
  {
    slug: '2026-08',
    title: 'August 2026',
    summary: 'Python SDK, migration guide, and regional usage.',
    bullets: [
      'Python SDK reaches 1.0.',
      'Migration guide published.',
      'Usage API adds regional filters.',
    ],
  },
  {
    slug: '2026-07',
    title: 'July 2026',
    summary: 'Aether-05 and Aether-06 launch; Perth and Kourou come online.',
    bullets: [
      'Two nodes join the constellation.',
      'Perth and Kourou relay traffic.',
      'Optical link reaches 20 Gbps.',
    ],
  },
  {
    slug: '2026-06',
    title: 'June 2026',
    summary: 'Dedicated deployments, DPA updates, and a new status page.',
    bullets: [
      'Dedicated nodes available.',
      'DPA updated for regional routing.',
      'Incident history published.',
    ],
  },
  {
    slug: '2026-05',
    title: 'May 2026',
    summary: 'Tool calling, Go SDK, and a faster prefill path.',
    bullets: [
      'Tool calling is generally available.',
      'Go SDK published.',
      'Prefill throughput improves 18%.',
    ],
  },
  {
    slug: '2026-04',
    title: 'April 2026',
    summary: 'Scale plan, Hawaii station, and usage reconciliation.',
    bullets: [
      'Scale plan launches.',
      'Hawaii station enters service.',
      'Usage records include request IDs.',
    ],
  },
  {
    slug: '2026-03',
    title: 'March 2026',
    summary: 'Embeddings, reranking, and the model catalog.',
    bullets: [
      'Embeddings and reranking ship.',
      'Model catalog published.',
      'Estimator enters beta.',
    ],
  },
  {
    slug: '2026-02',
    title: 'February 2026',
    summary: 'Streaming handoffs and the first 128k request.',
    bullets: [
      'Streaming survives orbital handoffs.',
      'First 128k-context request served.',
      'Errors guide published.',
    ],
  },
  {
    slug: '2026-01',
    title: 'January 2026',
    summary: 'Aether-03 and Aether-04 launch; commercial service expands.',
    bullets: [
      'Two P2 nodes join the constellation.',
      'Commercial service opens to all developers.',
      'Svalbard adds a second optical terminal.',
    ],
  },
];

const CHANGELOG_DOCS = CHANGELOG.map((entry) => ({
  slug: entry.slug,
  title: entry.title,
  summary: entry.summary,
  updated: `${entry.slug}-01`,
  section: 'Changelog',
  sections: [
    {
      title: 'Shipped',
      body: entry.bullets,
      list: entry.bullets,
    },
  ],
  related: [
    { label: 'Docs', to: '/docs' },
    { label: 'Mission log', to: '/mission-log' },
    { label: 'Status', to: '/resources/status' },
  ],
}));

export const DOCS = [
  ...GUIDES.map((doc) => ({ ...doc, section: 'Guides' })),
  ...API_REFERENCES.map((doc) => ({ ...doc, section: 'API' })),
  ...SDKS.map((doc) => ({ ...doc, section: 'SDKs' })),
  ...CHANGELOG_DOCS,
];

export const DOC_SECTIONS = ['Guides', 'API', 'SDKs', 'Changelog'];

export const DOC_SECTION_PATHS = {
  Guides: 'guides',
  API: 'api',
  SDKs: 'sdk',
  Changelog: 'changelog',
};

/**
 * Finds a docs page by section and slug.
 * @param {string} section
 * @param {string} slug
 * @returns {(typeof DOCS)[number] | undefined}
 */
export function getDoc(section, slug) {
  return DOCS.find((doc) => doc.section === section && doc.slug === slug);
}

/**
 * Finds a docs page by its global slug when the section is not needed.
 * @param {string} slug
 * @returns {(typeof DOCS)[number] | undefined}
 */
export function getDocBySlug(slug) {
  return DOCS.find((doc) => doc.slug === slug);
}

/**
 * Resolves a docs page from its full URL path.
 * @param {string} pathname
 * @returns {(typeof DOCS)[number] | undefined}
 */
export function getDocFromPath(pathname) {
  const match = pathname.match(/^\/docs\/(guides|api|sdk|changelog)\/([^/]+)$/);
  if (!match) return undefined;
  const section = {
    guides: 'Guides',
    api: 'API',
    sdk: 'SDKs',
    changelog: 'Changelog',
  }[match[1]];
  return getDoc(section, match[2]);
}
