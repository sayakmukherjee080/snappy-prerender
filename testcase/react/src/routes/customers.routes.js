import { CUSTOMERS, getCustomer } from '../content/catalog/customers.js';
import { makeRoute } from './helpers.js';

export const customersRoutes = [
  makeRoute({
    path: '/customers',
    load: () => import('../pages/customers/CustomersIndexPage.jsx'),
    meta: () => ({
      title: 'Customers',
      description:
        'Teams that moved a real workload onto the orbital mesh and kept a ground fallback.',
    }),
  }),
  makeRoute({
    path: '/customers/:slug',
    staticPaths: CUSTOMERS.map((customer) => `/customers/${customer.slug}`),
    load: () => import('../pages/customers/CustomerPage.jsx'),
    meta: (params) => {
      const customer = getCustomer(params.slug);
      return {
        title: customer?.name ?? 'Customer',
        description: customer?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const customer = getCustomer(params.slug);
      return [{ label: 'Customers', to: '/customers' }, { label: customer?.name ?? params.slug }];
    },
  }),
];
