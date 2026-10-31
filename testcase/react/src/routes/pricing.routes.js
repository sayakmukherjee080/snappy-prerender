import { getPricingPage, PRICING_PAGES } from '../content/catalog/pricing.js';
import { makeRoute } from './helpers.js';

export const pricingRoutes = [
  makeRoute({
    path: '/pricing/:slug',
    staticPaths: PRICING_PAGES.map((page) => `/pricing/${page.slug}`),
    load: () => import('../pages/pricing/PricingDetailPage.jsx'),
    meta: (params) => {
      const page = getPricingPage(params.slug);
      return {
        title: page?.title ?? 'Pricing',
        description: page?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const page = getPricingPage(params.slug);
      return [{ label: 'Pricing', to: '/pricing' }, { label: page?.title ?? params.slug }];
    },
  }),
];
