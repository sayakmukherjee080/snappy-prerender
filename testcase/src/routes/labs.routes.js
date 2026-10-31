import { LABS } from '../content/catalog/labs.js';
import { makeRoute } from './helpers.js';

const LAB_LOADERS = {
  'command-palette': () => import('../features/labs/CommandPaletteLab.jsx'),
  'virtual-list': () => import('../features/labs/VirtualListLab.jsx'),
  'canvas-orbit': () => import('../features/labs/CanvasOrbitLab.jsx'),
  'worker-sim': () => import('../features/labs/WorkerSimLab.jsx'),
  'view-transitions': () => import('../features/labs/ViewTransitionsLab.jsx'),
  'drag-planner': () => import('../features/labs/DragPlannerLab.jsx'),
  'error-boundaries': () => import('../features/labs/ErrorBoundariesLab.jsx'),
  'activity-tabs': () => import('../features/labs/ActivityTabsLab.jsx'),
  'optimistic-queue': () => import('../features/labs/OptimisticQueueLab.jsx'),
  'suspense-resource': () => import('../features/labs/SuspenseResourceLab.jsx'),
  'sync-store': () => import('../features/labs/SyncStoreLab.jsx'),
  'deferred-search': () => import('../features/labs/DeferredSearchLab.jsx'),
  'layout-tooltip': () => import('../features/labs/LayoutTooltipLab.jsx'),
  'insertion-theme': () => import('../features/labs/InsertionThemeLab.jsx'),
  'imperative-dialog': () => import('../features/labs/ImperativeDialogLab.jsx'),
  'effect-event': () => import('../features/labs/EffectEventLab.jsx'),
  'id-tabs': () => import('../features/labs/IdTabsLab.jsx'),
  'debug-value': () => import('../features/labs/DebugValueLab.jsx'),
  'transition-nav': () => import('../features/labs/TransitionNavLab.jsx'),
  'controllable-state': () => import('../features/labs/ControllableStateLab.jsx'),
  'head-parity': () => import('../features/labs/HeadParityLab.jsx'),
  'default-title': () => import('../features/labs/DefaultTitleLab.jsx'),
  'noindex-fixture': () => import('../pages/Private.jsx'),
};

// These fixtures let the package Head component own metadata instead of usePageMeta.
const HEAD_ONLY_LABS = new Set(['head-parity', 'default-title', 'noindex-fixture']);

export const labRoutes = [
  makeRoute({
    path: '/lab',
    load: () => import('../pages/lab/LabIndexPage.jsx'),
    layout: 'lab',
    hidden: true,
    meta: () => ({
      title: 'Unlisted lab',
      description: 'Twenty-four experimental React demos behind a demo gate.',
    }),
  }),
  ...LABS.map((lab) =>
    makeRoute({
      path: `/lab/${lab.slug}`,
      load: LAB_LOADERS[lab.slug],
      layout: 'lab',
      hidden: true,
      headOnly: HEAD_ONLY_LABS.has(lab.slug),
      meta: () => ({
        title: lab.title,
        description: lab.summary,
      }),
      breadcrumbs: () => [{ label: 'Lab', to: '/lab' }, { label: lab.title }],
    }),
  ),
];
