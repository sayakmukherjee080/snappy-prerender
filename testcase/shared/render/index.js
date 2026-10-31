import { DOC_SECTION_PATHS, getDoc } from '../content/catalog/docs.js';
import { LABS } from '../content/catalog/labs.js';
import { apiArticlePage, apiError, apiIndexPage, apiSkeleton } from './api.js';
import { hiddenGate, renderApp } from './base.js';
import {
  blogIndexPage,
  blogPostPage,
  companyDetailPage,
  customerPage,
  customersIndexPage,
  docPage,
  docsIndexPage,
  docsLayout,
  labIndexPage,
  labLayout,
  labPage,
  legalIndexPage,
  legalPage,
  modelPage,
  modelSpecialPage,
  modelsIndexPage,
  networkCorePage,
  notFoundPage,
  platformDetailPage,
  pricingDetailPage,
  regionPage,
  regionsIndexPage,
  resourcePage,
  resourcesIndexPage,
  satellitePage,
  solutionPage,
  solutionsIndexPage,
  stationPage,
} from './catalog.js';
import { companyPage } from './company.js';
import { homePage } from './home.js';
import { networkPage } from './network.js';
import { platformPage } from './platform.js';
import { pricingPage } from './pricing.js';

const DEFAULT_META = {
  title: 'Orbital inference network',
  description:
    'Aether Compute operates radiation-hardened GPU nodes in low Earth orbit, serving low-latency LLM inference over an optical mesh.',
};

/**
 * Renders the main content for a matched route.
 * @param {object} route
 * @param {Record<string, string>} params
 * @param {object} state
 * @returns {string}
 */
function renderContent(route, params, state) {
  switch (route.page) {
    case 'home':
      return homePage();
    case 'platform':
      return platformPage();
    case 'platform-detail':
      return platformDetailPage(params.slug);
    case 'network':
      return networkPage();
    case 'network-core':
      return networkCorePage(params.slug);
    case 'satellite':
      return satellitePage(params.slug);
    case 'station':
      return stationPage(params.slug);
    case 'pricing':
      return pricingPage();
    case 'pricing-detail':
      return pricingDetailPage(params.slug);
    case 'company':
      return companyPage();
    case 'company-detail':
      return companyDetailPage(params.slug);
    case 'models-index':
      return modelsIndexPage();
    case 'model':
      return modelPage(params.slug);
    case 'model-special':
      return modelSpecialPage(route.props?.slug ?? params.slug);
    case 'docs-index':
      return docsIndexPage();
    case 'doc':
      return docPage(route.props?.section, params.slug);
    case 'blog-index':
      return blogIndexPage('blog');
    case 'blog-post':
      return blogPostPage('blog', params.slug);
    case 'mission-index':
      return blogIndexPage('mission');
    case 'mission-post':
      return blogPostPage('mission', params.slug);
    case 'customers-index':
      return customersIndexPage();
    case 'customer':
      return customerPage(params.slug);
    case 'legal-index':
      return legalIndexPage();
    case 'legal':
      return legalPage(params.slug);
    case 'regions-index':
      return regionsIndexPage();
    case 'region':
      return regionPage(params.slug);
    case 'resources-index':
      return resourcesIndexPage();
    case 'resource':
      return resourcePage(params.slug);
    case 'solutions-index':
      return solutionsIndexPage();
    case 'solution':
      return solutionPage(params.slug);
    case 'api-index':
      if (state.news?.status === 'error') return apiError();
      if (state.news?.status === 'ready') return apiIndexPage(state.news.data);
      return apiSkeleton();
    case 'api-article':
      if (state.news?.status === 'error') return apiError();
      if (state.news?.status === 'ready') return apiArticlePage(state.news.data, params.index);
      return apiSkeleton();
    case 'lab-index':
      return labIndexPage();
    case 'lab':
      return labPage(route.props?.slug ?? params.slug);
    case 'not-found':
      return notFoundPage();
    default:
      return notFoundPage();
  }
}

/**
 * Wraps route content in the layout the route declares.
 * @param {object} route
 * @param {Record<string, string>} params
 * @param {object} state
 * @param {string} content
 * @returns {string}
 */
function renderWithLayout(route, params, state, content) {
  if (route.hidden && !state.hiddenUnlocked) return hiddenGate();

  if (route.layout === 'docs') {
    const doc = route.page === 'doc' ? getDoc(route.props?.section, params.slug) : undefined;
    return docsLayout({ content, path: state.path, doc });
  }

  if (route.layout === 'lab' && state.hiddenUnlocked) {
    const crumbs =
      route.page === 'lab'
        ? [
            { label: 'Lab', to: '/lab' },
            {
              label:
                LABS.find((lab) => lab.slug === (route.props?.slug ?? params.slug))?.title ?? 'Lab',
            },
          ]
        : [];
    return labLayout({ content, path: state.path, crumbs });
  }

  return content;
}

/**
 * Renders a complete document body for a matched route.
 * @param {object} route
 * @param {Record<string, string>} params
 * @param {object} state
 * @returns {{ content: string, title: string, description: string, noindex: boolean, notFound: boolean, headOnly: boolean, layout: string }}
 */
export function renderRoute(route, params, state) {
  let meta = route.meta?.(params) ?? DEFAULT_META;
  let notFound = route.page === 'not-found';
  let noindex = Boolean(route.noindex || route.hidden);
  if (route.page === 'api-index' && state.news?.status === 'error') noindex = true;
  if (route.page === 'api-article') {
    const index = Number(params.index);
    const article = state.news?.status === 'ready' ? state.news.data?.articles?.[index - 1] : null;
    if (state.news?.status === 'ready') notFound = !article;
    else if (state.news?.status === 'error') notFound = true;
    meta = article
      ? {
          title: article.title,
          description: `API article ${index}: ${article.summary.slice(0, 160) || article.title}`,
        }
      : {
          title: `API article ${index}`,
          description: `API article ${index}: the live source did not return this record.`,
        };
  }
  const content = renderContent(route, params, state);
  return {
    content: renderWithLayout(route, params, state, content),
    title: meta.title ?? DEFAULT_META.title,
    description: meta.description ?? DEFAULT_META.description,
    noindex: Boolean(noindex || notFound),
    notFound,
    headOnly: Boolean(route.headOnly),
    layout: route.layout,
  };
}

/**
 * Renders the complete page shell for a matched route.
 * @param {object} route
 * @param {Record<string, string>} params
 * @param {object} state
 * @returns {{ html: string, title: string, description: string, noindex: boolean, notFound: boolean, headOnly: boolean }}
 */
export function renderDocument(route, params, state) {
  const page = renderRoute(route, params, state);
  return {
    html: renderApp({ path: state.path, content: page.content }),
    title: page.title,
    description: page.description,
    noindex: page.noindex,
    notFound: page.notFound,
    headOnly: page.headOnly,
  };
}

export { DOC_SECTION_PATHS };
