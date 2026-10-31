import { makeRoute } from './helpers.js';

export const mainRoutes = [
  makeRoute({
    path: '/',
    load: () => import('../pages/Home.jsx'),
    meta: () => ({
      title: 'Orbital inference network',
      description:
        'Aether Compute operates radiation-hardened GPU nodes in low Earth orbit, serving low-latency LLM inference over an optical mesh.',
    }),
  }),
  makeRoute({
    path: '/platform',
    load: () => import('../pages/Platform.jsx'),
    meta: () => ({
      title: 'Platform',
      description:
        'Inside an Aether orbital node: radiation-hardened accelerators, 42 kW of solar, an OpenAI-compatible inference API, and seamless orbital handoffs.',
    }),
  }),
  makeRoute({
    path: '/network',
    load: () => import('../pages/Network.jsx'),
    meta: () => ({
      title: 'Network',
      description:
        'Twenty-four satellites, six orbital planes, eight ground stations, and an optical mesh that routes LLM inference around the horizon.',
    }),
  }),
  makeRoute({
    path: '/pricing',
    load: () => import('../pages/Pricing.jsx'),
    meta: () => ({
      title: 'Pricing',
      description:
        'Aether Compute pricing: usage-based orbital inference from $0.85 per million input tokens, reserved capacity, and dedicated nodes.',
    }),
  }),
  makeRoute({
    path: '/company',
    load: () => import('../pages/Company.jsx'),
    meta: () => ({
      title: 'Company',
      description:
        'Aether Compute is building the infrastructure layer for intelligence off Earth. Meet the team, read the timeline, and open a channel.',
    }),
  }),
];
