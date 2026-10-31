import { getModel, MODEL_SPECIALS, MODELS } from '../content/catalog/models.js';
import { makeRoute } from './helpers.js';

const specialRoute = (page) =>
  makeRoute({
    path: `/models/${page.slug}`,
    load: () => import('../pages/models/ModelSpecialPage.jsx'),
    props: { slug: page.slug },
    meta: () => ({
      title: page.title,
      description: page.summary,
    }),
    breadcrumbs: () => [{ label: 'Models', to: '/models' }, { label: page.title }],
  });

export const modelsRoutes = [
  makeRoute({
    path: '/models',
    load: () => import('../pages/models/ModelsIndexPage.jsx'),
    meta: () => ({
      title: 'Model catalog',
      description:
        'Context, modality, token price, and serving profile for every model on the orbital network.',
    }),
  }),
  ...MODEL_SPECIALS.map(specialRoute),
  makeRoute({
    path: '/models/:slug',
    staticPaths: MODELS.map((model) => `/models/${model.slug}`),
    load: () => import('../pages/models/ModelPage.jsx'),
    meta: (params) => {
      const model = getModel(params.slug);
      return {
        title: model?.name ?? 'Model',
        description: model?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const model = getModel(params.slug);
      return [{ label: 'Models', to: '/models' }, { label: model?.name ?? params.slug }];
    },
  }),
];
