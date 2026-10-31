import { API_SOURCE } from '../content/apiSource.js';
import { makeRoute } from './helpers.js';

export const apiRoutes = [
  makeRoute({
    path: '/api',
    load: () => import('../pages/api/ApiIndexPage.jsx'),
    headOnly: true,
    meta: () => ({
      title: 'API explorer',
      description:
        'Fifty live pages built at runtime from the Spaceflight News API, with no local article fixtures.',
    }),
  }),
  makeRoute({
    path: '/api/articles/:index',
    staticPaths: Array.from(
      { length: API_SOURCE.limit },
      (_, index) => `/api/articles/${index + 1}`,
    ),
    load: () => import('../pages/api/ApiArticlePage.jsx'),
    headOnly: true,
    meta: (params) => ({
      title: `API article ${params.index}`,
      description: 'A live article record fetched from the Spaceflight News API at runtime.',
    }),
    breadcrumbs: (params) => [{ label: 'API', to: '/api' }, { label: `Article ${params.index}` }],
  }),
];
