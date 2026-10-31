import { getResource, RESOURCES } from '../content/catalog/resources.js';
import { makeRoute } from './helpers.js';

export const resourcesRoutes = [
  makeRoute({
    path: '/resources',
    load: () => import('../pages/resources/ResourcesIndexPage.jsx'),
    meta: () => ({
      title: 'Resources',
      description:
        'Support, status, brand, residency, and operating tools for the orbital network.',
    }),
  }),
  makeRoute({
    path: '/resources/:slug',
    staticPaths: RESOURCES.map((resource) => `/resources/${resource.slug}`),
    load: () => import('../pages/resources/ResourcePage.jsx'),
    meta: (params) => {
      const resource = getResource(params.slug);
      return {
        title: resource?.title ?? 'Resource',
        description: resource?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const resource = getResource(params.slug);
      return [{ label: 'Resources', to: '/resources' }, { label: resource?.title ?? params.slug }];
    },
  }),
];
