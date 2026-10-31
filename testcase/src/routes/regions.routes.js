import { getRegion, REGIONS } from '../content/catalog/regions.js';
import { makeRoute } from './helpers.js';

export const regionsRoutes = [
  makeRoute({
    path: '/regions',
    load: () => import('../pages/regions/RegionsIndexPage.jsx'),
    meta: () => ({
      title: 'Regions',
      description: 'Ground-segment coverage, metro latency, and residency boundaries by region.',
    }),
  }),
  makeRoute({
    path: '/regions/:slug',
    staticPaths: REGIONS.map((region) => `/regions/${region.slug}`),
    load: () => import('../pages/regions/RegionPage.jsx'),
    meta: (params) => {
      const region = getRegion(params.slug);
      return {
        title: region?.title ?? 'Region',
        description: region?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const region = getRegion(params.slug);
      return [{ label: 'Regions', to: '/regions' }, { label: region?.title ?? params.slug }];
    },
  }),
];
