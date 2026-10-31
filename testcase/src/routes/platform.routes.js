import { getPlatformPage, PLATFORM_PAGES } from '../content/catalog/platform.js';
import { makeRoute } from './helpers.js';

export const platformRoutes = [
  makeRoute({
    path: '/platform/:slug',
    staticPaths: PLATFORM_PAGES.map((page) => `/platform/${page.slug}`),
    load: () => import('../pages/platform/PlatformDetailPage.jsx'),
    meta: (params) => {
      const page = getPlatformPage(params.slug);
      return {
        title: page?.title ?? 'Platform',
        description: page?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const page = getPlatformPage(params.slug);
      return [{ label: 'Platform', to: '/platform' }, { label: page?.title ?? params.slug }];
    },
  }),
];
