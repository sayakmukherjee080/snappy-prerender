import { BLOG_POSTS, MISSION_LOG } from '../content/catalog/blog.js';
import { makeRoute } from './helpers.js';

export const blogRoutes = [
  makeRoute({
    path: '/blog',
    load: () => import('../pages/blog/BlogIndexPage.jsx'),
    meta: () => ({
      title: 'Blog',
      description:
        'Latency, ground segments, radiation, and the engineering behind orbital inference.',
    }),
  }),
  makeRoute({
    path: '/blog/:slug',
    staticPaths: BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    load: () => import('../pages/blog/BlogPage.jsx'),
    meta: (params) => {
      const post = BLOG_POSTS.find((item) => item.slug === params.slug);
      return {
        title: post?.title ?? 'Blog',
        description: post?.excerpt ?? '',
      };
    },
    breadcrumbs: (params) => {
      const post = BLOG_POSTS.find((item) => item.slug === params.slug);
      return [{ label: 'Blog', to: '/blog' }, { label: post?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/mission-log',
    load: () => import('../pages/blog/BlogIndexPage.jsx'),
    props: { kind: 'mission' },
    meta: () => ({
      title: 'Mission log',
      description:
        'Short operational notes from the constellation: handoffs, station acceptance, and anomalies.',
    }),
  }),
  makeRoute({
    path: '/mission-log/:slug',
    staticPaths: MISSION_LOG.map((entry) => `/mission-log/${entry.slug}`),
    load: () => import('../pages/blog/BlogPage.jsx'),
    props: { kind: 'mission' },
    meta: (params) => {
      const entry = MISSION_LOG.find((item) => item.slug === params.slug);
      return {
        title: entry?.title ?? 'Mission log',
        description: entry?.excerpt ?? '',
      };
    },
    breadcrumbs: (params) => {
      const entry = MISSION_LOG.find((item) => item.slug === params.slug);
      return [{ label: 'Mission log', to: '/mission-log' }, { label: entry?.title ?? params.slug }];
    },
  }),
];
