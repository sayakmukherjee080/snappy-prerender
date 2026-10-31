import { DOC_SECTION_PATHS, DOCS, getDoc } from '../content/catalog/docs.js';
import { makeRoute } from './helpers.js';

/**
 * Builds the route record for one documentation section.
 * @param {string} section
 * @param {string} pathSegment
 * @returns {object}
 */
function sectionRoute(section, pathSegment) {
  const docs = DOCS.filter((doc) => doc.section === section);
  return makeRoute({
    path: `/docs/${pathSegment}/:slug`,
    staticPaths: docs.map((doc) => `/docs/${pathSegment}/${doc.slug}`),
    load: () => import('../pages/docs/DocPage.jsx'),
    layout: 'docs',
    props: { section },
    meta: (params) => {
      const doc = getDoc(section, params.slug);
      return {
        title: doc?.title ?? section,
        description: doc?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const doc = getDoc(section, params.slug);
      return [
        { label: 'Docs', to: '/docs' },
        { label: section },
        { label: doc?.title ?? params.slug },
      ];
    },
  });
}

export const docsRoutes = [
  makeRoute({
    path: '/docs',
    load: () => import('../pages/docs/DocsIndexPage.jsx'),
    layout: 'docs',
    meta: () => ({
      title: 'Documentation',
      description:
        'Quickstart, API references, SDKs, and the changelog for the Aether orbital inference network.',
    }),
  }),
  sectionRoute('Guides', DOC_SECTION_PATHS.Guides),
  sectionRoute('API', DOC_SECTION_PATHS.API),
  sectionRoute('SDKs', DOC_SECTION_PATHS.SDKs),
  sectionRoute('Changelog', DOC_SECTION_PATHS.Changelog),
];
