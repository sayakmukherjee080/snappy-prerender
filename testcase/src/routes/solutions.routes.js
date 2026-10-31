import { getSolution, SOLUTIONS } from '../content/catalog/solutions.js';
import { makeRoute } from './helpers.js';

export const solutionsRoutes = [
  makeRoute({
    path: '/solutions',
    load: () => import('../pages/solutions/SolutionsIndexPage.jsx'),
    meta: () => ({
      title: 'Solutions',
      description:
        'Orbital inference for finance, healthcare, robotics, research, media, logistics, and other industries.',
    }),
  }),
  makeRoute({
    path: '/solutions/:slug',
    staticPaths: SOLUTIONS.map((solution) => `/solutions/${solution.slug}`),
    load: () => import('../pages/solutions/SolutionPage.jsx'),
    meta: (params) => {
      const solution = getSolution(params.slug);
      return {
        title: solution?.title ?? 'Solution',
        description: solution?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const solution = getSolution(params.slug);
      return [{ label: 'Solutions', to: '/solutions' }, { label: solution?.title ?? params.slug }];
    },
  }),
];
