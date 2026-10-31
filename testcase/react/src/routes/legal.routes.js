import { getLegalPage, LEGAL_PAGES } from '../content/catalog/legal.js';
import { makeRoute } from './helpers.js';

export const legalRoutes = [
  makeRoute({
    path: '/legal',
    load: () => import('../pages/legal/LegalIndexPage.jsx'),
    meta: () => ({
      title: 'Legal and trust',
      description:
        'Privacy, terms, data processing, the SLA, and the trust documents behind the network.',
    }),
  }),
  makeRoute({
    path: '/legal/:slug',
    staticPaths: LEGAL_PAGES.map((page) => `/legal/${page.slug}`),
    load: () => import('../pages/legal/LegalPage.jsx'),
    meta: (params) => {
      const page = getLegalPage(params.slug);
      return {
        title: page?.title ?? 'Legal',
        description: page?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const page = getLegalPage(params.slug);
      return [{ label: 'Legal', to: '/legal' }, { label: page?.title ?? params.slug }];
    },
  }),
];
