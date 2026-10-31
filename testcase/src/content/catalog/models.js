export const MODELS = [
  {
    slug: 'aether-70b-instruct',
    name: 'Aether 70B Instruct',
    family: 'Flagship',
    context: '128k',
    params: '70B',
    input: '$0.68 / 1M',
    output: '$1.92 / 1M',
    modality: 'Text',
    summary:
      'The general-purpose flagship for long-context reasoning, tool use, and production chat.',
    meta: [
      { label: 'Context', value: '128k' },
      { label: 'Parameters', value: '70B' },
      { label: 'Modality', value: 'Text' },
    ],
    sections: [
      {
        title: 'When to use it',
        body: [
          'The 70B is the default for products that need strong instruction following, long context, and reliable tool calls without the latency of a larger model.',
        ],
        list: [
          'Long document analysis',
          'Agentic tool loops',
          'Structured extraction',
          'Production chat',
        ],
      },
      {
        title: 'Serving profile',
        body: [
          'It runs on a full Aether node with a handoff-aware KV cache. Streaming survives a satellite change without a reconnect.',
        ],
      },
    ],
    benchmarks: [
      { label: 'MMLU', value: 84, max: 100 },
      { label: 'HumanEval', value: 78, max: 100 },
      { label: 'GSM8K', value: 91, max: 100 },
    ],
    related: [
      { label: 'Compare models', to: '/models/compare' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
    ],
  },
  {
    slug: 'aether-8x22b',
    name: 'Aether 8×22B',
    family: 'Mixture of experts',
    context: '128k',
    params: '8×22B',
    input: '$0.74 / 1M',
    output: '$2.10 / 1M',
    modality: 'Text',
    summary:
      'A sparse model for high-throughput reasoning where token cost matters more than a single-pass p50.',
    meta: [
      { label: 'Context', value: '128k' },
      { label: 'Parameters', value: '8×22B' },
      { label: 'Modality', value: 'Text' },
    ],
    sections: [
      {
        title: 'Sparse by design',
        body: [
          'The mixture-of-experts model activates a fraction of its parameters per token, trading a little latency for a lower cost per million tokens.',
        ],
      },
      {
        title: 'Best for batch work',
        body: [
          'Use it for classification, extraction, and high-volume generation where a 20 ms p50 difference is less important than throughput.',
        ],
      },
    ],
    benchmarks: [
      { label: 'MMLU', value: 81, max: 100 },
      { label: 'HumanEval', value: 72, max: 100 },
      { label: 'GSM8K', value: 86, max: 100 },
    ],
    related: [
      { label: '70B Instruct', to: '/models/aether-70b-instruct' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
      { label: 'Scale plan', to: '/pricing/scale' },
    ],
  },
  {
    slug: 'aether-8b',
    name: 'Aether 8B',
    family: 'Efficient',
    context: '32k',
    params: '8B',
    input: '$0.18 / 1M',
    output: '$0.54 / 1M',
    modality: 'Text',
    summary:
      'A small, fast model for classification, routing, and latency-critical short responses.',
    meta: [
      { label: 'Context', value: '32k' },
      { label: 'Parameters', value: '8B' },
      { label: 'Modality', value: 'Text' },
    ],
    sections: [
      {
        title: 'The cheap first hop',
        body: [
          'Use the 8B as a router or classifier in front of the larger models. It is fast enough to sit in the request path without becoming the bottleneck.',
        ],
      },
      {
        title: 'Short and deterministic',
        body: ['It is tuned for short outputs and structured decisions, not long-form writing.'],
      },
    ],
    benchmarks: [
      { label: 'MMLU', value: 68, max: 100 },
      { label: 'HumanEval', value: 52, max: 100 },
      { label: 'GSM8K', value: 71, max: 100 },
    ],
    related: [
      { label: '70B Instruct', to: '/models/aether-70b-instruct' },
      { label: 'Deprecated', to: '/models/deprecated' },
      { label: 'Developer plan', to: '/pricing/developer' },
    ],
  },
  {
    slug: 'aether-embed',
    name: 'Aether Embed',
    family: 'Retrieval',
    context: '8k',
    params: '—',
    input: '$0.05 / 1M',
    output: '—',
    modality: 'Text → vector',
    summary: '1024- or 3072-dimension embeddings for retrieval, clustering, and deduplication.',
    meta: [
      { label: 'Dimensions', value: '1024 / 3072' },
      { label: 'Context', value: '8k' },
      { label: 'Batch', value: '256 inputs' },
    ],
    sections: [
      {
        title: 'Built for retrieval',
        body: [
          'The embedding model is trained for asymmetric retrieval: short queries against long documents. Choose one dimension and keep the index consistent.',
        ],
      },
      {
        title: 'Batch semantics',
        body: [
          'Inputs are returned in order. The endpoint accepts up to 256 inputs per request and preserves usage metadata per batch.',
        ],
      },
    ],
    benchmarks: [
      { label: 'MTEB', value: 72, max: 100 },
      { label: 'Recall@10', value: 94, max: 100 },
      { label: 'p50 batch', value: 41, max: 100 },
    ],
    related: [
      { label: 'Embeddings guide', to: '/docs/guides/embeddings' },
      { label: 'Embeddings API', to: '/docs/api/embeddings' },
      { label: 'Rerank', to: '/models/aether-rerank' },
    ],
  },
  {
    slug: 'aether-rerank',
    name: 'Aether Rerank',
    family: 'Retrieval',
    context: '32k',
    params: '—',
    input: '$0.12 / 1M',
    output: '—',
    modality: 'Query + documents',
    summary: 'Cross-encoder reranking for the last mile of a retrieval pipeline.',
    meta: [
      { label: 'Context', value: '32k' },
      { label: 'Documents', value: '100 / call' },
      { label: 'Output', value: 'Scores' },
    ],
    sections: [
      {
        title: 'Rerank after recall',
        body: [
          'Use embeddings for recall and rerank for precision. The cross-encoder scores query-document pairs directly and returns a sorted list.',
        ],
      },
      {
        title: 'Latency budget',
        body: [
          'Keep candidate sets under 100 documents per call. Above that, shard the query and merge the scores on the ground.',
        ],
      },
    ],
    benchmarks: [
      { label: 'NDCG@10', value: 91, max: 100 },
      { label: 'MRR', value: 88, max: 100 },
      { label: 'p50', value: 63, max: 100 },
    ],
    related: [
      { label: 'Embed', to: '/models/aether-embed' },
      { label: 'Embeddings guide', to: '/docs/guides/embeddings' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
    ],
  },
  {
    slug: 'aether-vision',
    name: 'Aether Vision',
    family: 'Multimodal',
    context: '64k',
    params: '34B',
    input: '$0.92 / 1M',
    output: '$2.80 / 1M',
    modality: 'Text + image',
    summary: 'Image understanding for inspection, document extraction, and visual QA.',
    meta: [
      { label: 'Context', value: '64k' },
      { label: 'Parameters', value: '34B' },
      { label: 'Modality', value: 'Text + image' },
    ],
    sections: [
      {
        title: 'Visual inspection',
        body: [
          'The vision model accepts images as URLs or base64 payloads. It is tuned for document extraction, component inspection, and visual question answering.',
        ],
      },
      {
        title: 'Ground validation',
        body: [
          'Treat extracted fields as untrusted input. Validate against a schema before writing them to a database.',
        ],
      },
    ],
    benchmarks: [
      { label: 'DocVQA', value: 89, max: 100 },
      { label: 'ChartQA', value: 82, max: 100 },
      { label: 'MMMU', value: 61, max: 100 },
    ],
    related: [
      { label: 'Structured outputs', to: '/docs/guides/structured-outputs' },
      { label: 'Chat completions', to: '/docs/api/chat-completions' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
    ],
  },
  {
    slug: 'aether-code',
    name: 'Aether Code',
    family: 'Code',
    context: '128k',
    params: '32B',
    input: '$0.62 / 1M',
    output: '$1.80 / 1M',
    modality: 'Text + code',
    summary: 'Repository-aware code generation, review, and test synthesis.',
    meta: [
      { label: 'Context', value: '128k' },
      { label: 'Parameters', value: '32B' },
      { label: 'Modality', value: 'Text + code' },
    ],
    sections: [
      {
        title: 'Repository context',
        body: [
          'The model is tuned for long code context: multi-file diffs, test synthesis, and review comments that cite the line they mean.',
        ],
      },
      {
        title: 'Tool loops',
        body: [
          'Pair it with tool calling to read files, run tests, and iterate. Keep the execution sandbox on the ground.',
        ],
      },
    ],
    benchmarks: [
      { label: 'HumanEval', value: 86, max: 100 },
      { label: 'SWE-bench', value: 42, max: 100 },
      { label: 'MBPP', value: 81, max: 100 },
    ],
    related: [
      { label: 'Tool calling', to: '/docs/guides/tools' },
      { label: '70B Instruct', to: '/models/aether-70b-instruct' },
      { label: 'Benchmarks', to: '/models/benchmarks' },
    ],
  },
  {
    slug: 'aether-mini',
    name: 'Aether Mini',
    family: 'Efficient',
    context: '16k',
    params: '3B',
    input: '$0.06 / 1M',
    output: '$0.18 / 1M',
    modality: 'Text',
    summary: 'A tiny model for routing, tagging, and high-volume classification.',
    meta: [
      { label: 'Context', value: '16k' },
      { label: 'Parameters', value: '3B' },
      { label: 'Modality', value: 'Text' },
    ],
    sections: [
      {
        title: 'Cheap decisions',
        body: [
          'Mini is for the decisions that do not need a flagship: routing, tagging, sentiment, and short extraction.',
        ],
      },
      {
        title: 'Cascade pattern',
        body: [
          'Run Mini first and escalate to the 70B only when confidence is low. The cascade usually beats a single larger model on cost.',
        ],
      },
    ],
    benchmarks: [
      { label: 'MMLU', value: 58, max: 100 },
      { label: 'HumanEval', value: 39, max: 100 },
      { label: 'GSM8K', value: 61, max: 100 },
    ],
    related: [
      { label: '8B', to: '/models/aether-8b' },
      { label: '70B Instruct', to: '/models/aether-70b-instruct' },
      { label: 'Developer plan', to: '/pricing/developer' },
    ],
  },
];

export const MODEL_SPECIALS = [
  {
    slug: 'compare',
    title: 'Compare models',
    summary: 'Context, modality, token price, and best-fit workload across the catalog.',
    widget: 'model-compare',
    sections: [
      {
        title: 'Pick by constraint',
        body: [
          'Start with modality and context, then compare token price. The flagship is rarely the right first hop for every request.',
        ],
      },
    ],
    related: [
      { label: 'Benchmarks', to: '/models/benchmarks' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Docs', to: '/docs' },
    ],
  },
  {
    slug: 'benchmarks',
    title: 'Benchmarks',
    summary: 'Measured scores, methodology notes, and the workloads behind the numbers.',
    widget: 'model-benchmarks',
    sections: [
      {
        title: 'Read the methodology',
        body: [
          'Scores are measured on the same node image and runtime used in production. They are directional, not a substitute for your own evaluation.',
        ],
      },
    ],
    related: [
      { label: 'Compare', to: '/models/compare' },
      { label: '70B Instruct', to: '/models/aether-70b-instruct' },
      { label: 'Deprecated', to: '/models/deprecated' },
    ],
  },
  {
    slug: 'deprecated',
    title: 'Deprecated models',
    summary: 'Retirement dates, migration targets, and the aliases that still resolve.',
    widget: 'model-deprecated',
    sections: [
      {
        title: 'Migration policy',
        body: [
          'Deprecated models remain callable for at least 90 days after the announcement. The model catalog marks a recommended replacement.',
        ],
      },
    ],
    related: [
      { label: 'Compare', to: '/models/compare' },
      { label: 'Docs', to: '/docs' },
      { label: 'Support', to: '/resources/support' },
    ],
  },
];

/**
 * Finds a model by slug.
 * @param {string} slug
 * @returns {(typeof MODELS)[number] | undefined}
 */
export function getModel(slug) {
  return MODELS.find((model) => model.slug === slug);
}

/**
 * Finds a special model page such as compare, benchmarks, or deprecated.
 * @param {string} slug
 * @returns {(typeof MODEL_SPECIALS)[number] | undefined}
 */
export function getModelSpecial(slug) {
  return MODEL_SPECIALS.find((page) => page.slug === slug);
}
