import { COMPANY_PAGES, getCompanyPage } from '../content/catalog/company.js';
import { makeRoute } from './helpers.js';

export const companyRoutes = [
  makeRoute({
    path: '/company/:slug',
    staticPaths: COMPANY_PAGES.map((page) => `/company/${page.slug}`),
    load: () => import('../pages/company/CompanyDetailPage.jsx'),
    meta: (params) => {
      const page = getCompanyPage(params.slug);
      return {
        title: page?.title ?? 'Company',
        description: page?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const page = getCompanyPage(params.slug);
      return [{ label: 'Company', to: '/company' }, { label: page?.title ?? params.slug }];
    },
  }),
];
