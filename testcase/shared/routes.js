import { API_SOURCE } from './content/apiSource.js';
import { BLOG_POSTS, MISSION_LOG } from './content/catalog/blog.js';
import { COMPANY_PAGES, getCompanyPage } from './content/catalog/company.js';
import { CUSTOMERS, getCustomer } from './content/catalog/customers.js';
import { DOC_SECTION_PATHS, DOCS, getDoc } from './content/catalog/docs.js';
import { LABS } from './content/catalog/labs.js';
import { getLegalPage, LEGAL_PAGES } from './content/catalog/legal.js';
import { getModel, MODEL_SPECIALS, MODELS } from './content/catalog/models.js';
import { getNetworkCorePage, NETWORK_CORE_PAGES } from './content/catalog/networkCore.js';
import { getPlatformPage, PLATFORM_PAGES } from './content/catalog/platform.js';
import { getPricingPage, PRICING_PAGES } from './content/catalog/pricing.js';
import { getRegion, REGIONS } from './content/catalog/regions.js';
import { getResource, RESOURCES } from './content/catalog/resources.js';
import { getSatellite, SATELLITES } from './content/catalog/satellites.js';
import { getSolution, SOLUTIONS } from './content/catalog/solutions.js';
import { getStation, STATIONS } from './content/catalog/stations.js';

/**
 * Builds a route record for the framework-agnostic site manifest.
 * @param {object} route
 * @returns {object}
 */
function makeRoute(route) {
  return {
    group: 'page',
    layout: 'marketing',
    hidden: false,
    ...route,
    staticPaths: route.staticPaths ?? [route.path],
  };
}

const docsSectionRoute = (section) =>
  makeRoute({
    path: `/docs/${DOC_SECTION_PATHS[section]}/:slug`,
    staticPaths: DOCS.filter((doc) => doc.section === section).map(
      (doc) => `/docs/${DOC_SECTION_PATHS[section]}/${doc.slug}`,
    ),
    page: 'doc',
    group: 'docs',
    layout: 'docs',
    props: { section },
    meta: (params) => {
      const doc = getDoc(section, params.slug);
      return { title: doc?.title ?? section, description: doc?.summary ?? '' };
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

export const routes = [
  makeRoute({
    path: '/',
    page: 'home',
    meta: () => ({
      title: 'Orbital inference network',
      description:
        'Aether Compute operates radiation-hardened GPU nodes in low Earth orbit, serving low-latency LLM inference over an optical mesh.',
    }),
  }),
  makeRoute({
    path: '/platform',
    page: 'platform',
    meta: () => ({
      title: 'Platform',
      description:
        'Inside an Aether orbital node: radiation-hardened accelerators, 42 kW of solar, an OpenAI-compatible inference API, and seamless orbital handoffs.',
    }),
  }),
  makeRoute({
    path: '/platform/:slug',
    staticPaths: PLATFORM_PAGES.map((page) => `/platform/${page.slug}`),
    page: 'platform-detail',
    meta: (params) => {
      const page = getPlatformPage(params.slug);
      return { title: page?.title ?? 'Platform', description: page?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const page = getPlatformPage(params.slug);
      return [{ label: 'Platform', to: '/platform' }, { label: page?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/network',
    page: 'network',
    meta: () => ({
      title: 'Network',
      description:
        'Twenty-four satellites, six orbital planes, eight ground stations, and an optical mesh that routes LLM inference around the horizon.',
    }),
  }),
  makeRoute({
    path: '/network/:slug',
    staticPaths: NETWORK_CORE_PAGES.map((page) => `/network/${page.slug}`),
    page: 'network-core',
    meta: (params) => {
      const page = getNetworkCorePage(params.slug);
      return { title: page?.title ?? 'Network', description: page?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const page = getNetworkCorePage(params.slug);
      return [{ label: 'Network', to: '/network' }, { label: page?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/network/satellites/:slug',
    staticPaths: SATELLITES.map((satellite) => `/network/satellites/${satellite.slug}`),
    page: 'satellite',
    meta: (params) => {
      const satellite = getSatellite(params.slug);
      return { title: satellite?.name ?? 'Satellite', description: satellite?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const satellite = getSatellite(params.slug);
      return [
        { label: 'Network', to: '/network' },
        { label: 'Satellites', to: '/network/constellation' },
        { label: satellite?.id ?? params.slug },
      ];
    },
  }),
  makeRoute({
    path: '/network/ground-stations/:slug',
    staticPaths: STATIONS.map((station) => `/network/ground-stations/${station.slug}`),
    page: 'station',
    meta: (params) => {
      const station = getStation(params.slug);
      return { title: station?.name ?? 'Ground station', description: station?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const station = getStation(params.slug);
      return [
        { label: 'Network', to: '/network' },
        { label: 'Ground stations', to: '/network/ground-stations' },
        { label: station?.name ?? params.slug },
      ];
    },
  }),
  makeRoute({
    path: '/pricing',
    page: 'pricing',
    meta: () => ({
      title: 'Pricing',
      description:
        'Aether Compute pricing: usage-based orbital inference from $0.85 per million input tokens, reserved capacity, and dedicated nodes.',
    }),
  }),
  makeRoute({
    path: '/pricing/:slug',
    staticPaths: PRICING_PAGES.map((page) => `/pricing/${page.slug}`),
    page: 'pricing-detail',
    meta: (params) => {
      const page = getPricingPage(params.slug);
      return { title: page?.title ?? 'Pricing', description: page?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const page = getPricingPage(params.slug);
      return [{ label: 'Pricing', to: '/pricing' }, { label: page?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/company',
    page: 'company',
    meta: () => ({
      title: 'Company',
      description:
        'Aether Compute is building the infrastructure layer for intelligence off Earth. Meet the team, read the timeline, and open a channel.',
    }),
  }),
  makeRoute({
    path: '/company/:slug',
    staticPaths: COMPANY_PAGES.map((page) => `/company/${page.slug}`),
    page: 'company-detail',
    meta: (params) => {
      const page = getCompanyPage(params.slug);
      return { title: page?.title ?? 'Company', description: page?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const page = getCompanyPage(params.slug);
      return [{ label: 'Company', to: '/company' }, { label: page?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/models',
    page: 'models-index',
    meta: () => ({
      title: 'Model catalog',
      description:
        'Context, modality, token price, and serving profile for every model on the orbital network.',
    }),
  }),
  ...MODEL_SPECIALS.map((page) =>
    makeRoute({
      path: `/models/${page.slug}`,
      page: 'model-special',
      props: { slug: page.slug },
      meta: () => ({ title: page.title, description: page.summary }),
      breadcrumbs: () => [{ label: 'Models', to: '/models' }, { label: page.title }],
    }),
  ),
  makeRoute({
    path: '/models/:slug',
    staticPaths: MODELS.map((model) => `/models/${model.slug}`),
    page: 'model',
    meta: (params) => {
      const model = getModel(params.slug);
      return { title: model?.name ?? 'Model', description: model?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const model = getModel(params.slug);
      return [{ label: 'Models', to: '/models' }, { label: model?.name ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/docs',
    page: 'docs-index',
    group: 'docs',
    layout: 'docs',
    meta: () => ({
      title: 'Documentation',
      description:
        'Quickstart, API references, SDKs, and the changelog for the Aether orbital inference network.',
    }),
  }),
  docsSectionRoute('Guides'),
  docsSectionRoute('API'),
  docsSectionRoute('SDKs'),
  docsSectionRoute('Changelog'),
  makeRoute({
    path: '/blog',
    page: 'blog-index',
    group: 'blog',
    meta: () => ({
      title: 'Blog',
      description:
        'Latency, ground segments, radiation, and the engineering behind orbital inference.',
    }),
  }),
  makeRoute({
    path: '/blog/:slug',
    staticPaths: BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    page: 'blog-post',
    group: 'blog',
    meta: (params) => {
      const post = BLOG_POSTS.find((item) => item.slug === params.slug);
      return { title: post?.title ?? 'Blog', description: post?.excerpt ?? '' };
    },
    breadcrumbs: (params) => {
      const post = BLOG_POSTS.find((item) => item.slug === params.slug);
      return [{ label: 'Blog', to: '/blog' }, { label: post?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/mission-log',
    page: 'mission-index',
    group: 'blog',
    meta: () => ({
      title: 'Mission log',
      description:
        'Short operational notes from the constellation: handoffs, station acceptance, and anomalies.',
    }),
  }),
  makeRoute({
    path: '/mission-log/:slug',
    staticPaths: MISSION_LOG.map((entry) => `/mission-log/${entry.slug}`),
    page: 'mission-post',
    group: 'blog',
    meta: (params) => {
      const entry = MISSION_LOG.find((item) => item.slug === params.slug);
      return { title: entry?.title ?? 'Mission log', description: entry?.excerpt ?? '' };
    },
    breadcrumbs: (params) => {
      const entry = MISSION_LOG.find((item) => item.slug === params.slug);
      return [{ label: 'Mission log', to: '/mission-log' }, { label: entry?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/customers',
    page: 'customers-index',
    group: 'customers',
    meta: () => ({
      title: 'Customers',
      description:
        'Teams that moved a real workload onto the orbital mesh and kept a ground fallback.',
    }),
  }),
  makeRoute({
    path: '/customers/:slug',
    staticPaths: CUSTOMERS.map((customer) => `/customers/${customer.slug}`),
    page: 'customer',
    group: 'customers',
    meta: (params) => {
      const customer = getCustomer(params.slug);
      return { title: customer?.name ?? 'Customer', description: customer?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const customer = getCustomer(params.slug);
      return [{ label: 'Customers', to: '/customers' }, { label: customer?.name ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/legal',
    page: 'legal-index',
    group: 'legal',
    meta: () => ({
      title: 'Legal and trust',
      description:
        'Privacy, terms, data processing, the SLA, and the trust documents behind the network.',
    }),
  }),
  makeRoute({
    path: '/legal/:slug',
    staticPaths: LEGAL_PAGES.map((page) => `/legal/${page.slug}`),
    page: 'legal',
    group: 'legal',
    meta: (params) => {
      const page = getLegalPage(params.slug);
      return { title: page?.title ?? 'Legal', description: page?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const page = getLegalPage(params.slug);
      return [{ label: 'Legal', to: '/legal' }, { label: page?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/regions',
    page: 'regions-index',
    group: 'regions',
    meta: () => ({
      title: 'Regions',
      description: 'Ground-segment coverage, metro latency, and residency boundaries by region.',
    }),
  }),
  makeRoute({
    path: '/regions/:slug',
    staticPaths: REGIONS.map((region) => `/regions/${region.slug}`),
    page: 'region',
    group: 'regions',
    meta: (params) => {
      const region = getRegion(params.slug);
      return { title: region?.title ?? 'Region', description: region?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const region = getRegion(params.slug);
      return [{ label: 'Regions', to: '/regions' }, { label: region?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/resources',
    page: 'resources-index',
    group: 'resources',
    meta: () => ({
      title: 'Resources',
      description:
        'Support, status, brand, residency, and operating tools for the orbital network.',
    }),
  }),
  makeRoute({
    path: '/resources/:slug',
    staticPaths: RESOURCES.map((resource) => `/resources/${resource.slug}`),
    page: 'resource',
    group: 'resources',
    meta: (params) => {
      const resource = getResource(params.slug);
      return { title: resource?.title ?? 'Resource', description: resource?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const resource = getResource(params.slug);
      return [{ label: 'Resources', to: '/resources' }, { label: resource?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/solutions',
    page: 'solutions-index',
    group: 'solutions',
    meta: () => ({
      title: 'Solutions',
      description:
        'Orbital inference for finance, healthcare, robotics, research, media, logistics, and other industries.',
    }),
  }),
  makeRoute({
    path: '/solutions/:slug',
    staticPaths: SOLUTIONS.map((solution) => `/solutions/${solution.slug}`),
    page: 'solution',
    group: 'solutions',
    meta: (params) => {
      const solution = getSolution(params.slug);
      return { title: solution?.title ?? 'Solution', description: solution?.summary ?? '' };
    },
    breadcrumbs: (params) => {
      const solution = getSolution(params.slug);
      return [{ label: 'Solutions', to: '/solutions' }, { label: solution?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/api',
    page: 'api-index',
    group: 'api',
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
    page: 'api-article',
    group: 'api',
    headOnly: true,
    meta: (params) => ({
      title: `API article ${params.index}`,
      description: 'A live article record fetched from the Spaceflight News API at runtime.',
    }),
    breadcrumbs: (params) => [{ label: 'API', to: '/api' }, { label: `Article ${params.index}` }],
  }),
  makeRoute({
    path: '/lab',
    page: 'lab-index',
    group: 'lab',
    layout: 'lab',
    hidden: true,
    meta: () => ({
      title: 'Unlisted lab',
      description: 'Twenty-four experimental demos behind a demo gate.',
    }),
  }),
  ...LABS.map((lab) =>
    makeRoute({
      path: `/lab/${lab.slug}`,
      page: 'lab',
      group: 'lab',
      layout: 'lab',
      hidden: true,
      props: { slug: lab.slug },
      meta: () => ({ title: lab.title, description: lab.summary }),
      breadcrumbs: () => [{ label: 'Lab', to: '/lab' }, { label: lab.title }],
    }),
  ),
];

export const NOT_FOUND_ROUTE = {
  path: '*',
  page: 'not-found',
  group: 'system',
  layout: 'marketing',
  hidden: false,
  noindex: true,
  staticPaths: ['/404'],
  meta: () => ({
    title: 'Page not found',
    description: 'The requested Aether Compute page does not exist.',
  }),
  breadcrumbs: () => [],
};

/**
 * Returns every published path in manifest order.
 * @param {Array<object>} manifest
 * @returns {string[]}
 */
export function getAllRoutePaths(manifest = routes) {
  return manifest.flatMap((route) => route.staticPaths ?? [route.path]);
}

export const routeCount = getAllRoutePaths(routes).length;
