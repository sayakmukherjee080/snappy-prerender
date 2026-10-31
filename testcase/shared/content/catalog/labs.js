export const LABS = [
  {
    slug: 'command-palette',
    title: 'Command palette',
    category: 'Overlay',
    summary: 'Portal, focus trap, inert background, deferred search, and keyboard navigation.',
    tags: ['createPortal', 'useDeferredValue', 'useEffectEvent', 'inert'],
  },
  {
    slug: 'virtual-list',
    title: 'Virtual list',
    category: 'Performance',
    summary: 'A 10,000-row telemetry table rendered from a measured window with memoized rows.',
    tags: ['useLayoutEffect', 'ResizeObserver', 'memo', 'useDeferredValue'],
  },
  {
    slug: 'canvas-orbit',
    title: 'Canvas orbit',
    category: 'Graphics',
    summary:
      'A requestAnimationFrame constellation with visibility pausing and reduced-motion fallback.',
    tags: ['Canvas', 'rAF', 'usePageVisibility', 'useEffectEvent'],
  },
  {
    slug: 'worker-sim',
    title: 'Worker simulator',
    category: 'Concurrency',
    summary: 'A Vite module worker streaming route simulations without blocking the main thread.',
    tags: ['Web Worker', 'useTransition', 'useReducer'],
  },
  {
    slug: 'view-transitions',
    title: 'View transitions',
    category: 'Animation',
    summary: 'A feature-detected View Transition around a flushSync state change.',
    tags: ['View Transitions', 'flushSync', 'prefers-reduced-motion'],
  },
  {
    slug: 'drag-planner',
    title: 'Drag planner',
    category: 'Interaction',
    summary: 'Pointer-driven capacity planning with a reducer state machine and optimistic commit.',
    tags: ['useReducer', 'useOptimistic', 'pointer events'],
  },
  {
    slug: 'error-boundaries',
    title: 'Error boundaries',
    category: 'Resilience',
    summary: 'Nested boundaries with reset keys and a deliberate fault injector.',
    tags: ['ErrorBoundary', 'reset keys', 'Suspense'],
  },
  {
    slug: 'activity-tabs',
    title: 'Activity tabs',
    category: 'React 19.2',
    summary: 'Hidden tabs keep their state alive with the Activity component.',
    tags: ['Activity', 'state preservation'],
  },
  {
    slug: 'optimistic-queue',
    title: 'Optimistic queue',
    category: 'React 19',
    summary:
      'An action-state form with an optimistic request queue and form-status submit control.',
    tags: ['useActionState', 'useOptimistic', 'useFormStatus'],
  },
  {
    slug: 'suspense-resource',
    title: 'Suspense resource',
    category: 'Data',
    summary: 'A cached promise read with use, a suspense boundary, and an error retry path.',
    tags: ['use', 'Suspense', 'ErrorBoundary'],
  },
  {
    slug: 'sync-store',
    title: 'Sync store',
    category: 'State',
    summary: 'An external preference store synced across tabs with BroadcastChannel.',
    tags: ['useSyncExternalStore', 'BroadcastChannel', 'localStorage'],
  },
  {
    slug: 'deferred-search',
    title: 'Deferred search',
    category: 'Performance',
    summary: 'A 5,000-item search that keeps typing responsive and marks stale results.',
    tags: ['useDeferredValue', 'useTransition', 'memo'],
  },
  {
    slug: 'layout-tooltip',
    title: 'Layout tooltip',
    category: 'Measurement',
    summary: 'A portal tooltip measured with ResizeObserver and flipped at the viewport edge.',
    tags: ['useLayoutEffect', 'ResizeObserver', 'createPortal'],
  },
  {
    slug: 'insertion-theme',
    title: 'Insertion theme',
    category: 'Styling',
    summary: 'Runtime CSS variables injected with useInsertionEffect and cleaned up on change.',
    tags: ['useInsertionEffect', 'CSS variables'],
  },
  {
    slug: 'imperative-dialog',
    title: 'Imperative dialog',
    category: 'Overlay',
    summary: 'A dialog that exposes open and close through a ref while owning its own focus trap.',
    tags: ['useImperativeHandle', 'ref prop', 'focus trap'],
  },
  {
    slug: 'effect-event',
    title: 'Effect event',
    category: 'React 19.2',
    summary: 'Interval and keyboard listeners that read fresh state without re-subscribing.',
    tags: ['useEffectEvent', 'useEffect'],
  },
  {
    slug: 'id-tabs',
    title: 'ID tabs',
    category: 'Accessibility',
    summary: 'Accessible tabs with useId, roving tabindex, and arrow-key navigation.',
    tags: ['useId', 'ARIA tabs', 'keyboard'],
  },
  {
    slug: 'debug-value',
    title: 'Debug value',
    category: 'Tooling',
    summary: 'Custom hooks labelled for React DevTools with useDebugValue.',
    tags: ['useDebugValue', 'custom hooks'],
  },
  {
    slug: 'transition-nav',
    title: 'Transition navigation',
    category: 'Routing',
    summary: 'Prefetched route navigation with a pending state and startTransition.',
    tags: ['useTransition', 'prefetch', 'startTransition'],
  },
  {
    slug: 'controllable-state',
    title: 'Controllable state',
    category: 'State',
    summary: 'One component that works controlled or uncontrolled through a custom hook.',
    tags: ['useControllableState', 'useDebugValue'],
  },
  {
    slug: 'head-parity',
    title: 'Head parity',
    category: 'Metadata',
    summary:
      'The client head layer with arbitrary tags, element attributes, multiple social values, and change callbacks.',
    tags: ['Head', 'tags', 'attributes', 'React 19'],
  },
  {
    slug: 'default-title',
    title: 'Default title',
    category: 'Metadata',
    summary: 'A document title that comes only from defaultTitle, with no page title.',
    tags: ['Head', 'defaultTitle'],
  },
  {
    slug: 'noindex-fixture',
    title: 'Noindex fixture',
    category: 'Metadata',
    summary: 'A Head-owned robots noindex page that must stay out of the sitemap.',
    tags: ['Head', 'robots', 'noindex'],
  },
];

/**
 * Finds a lab by slug.
 * @param {string} slug
 * @returns {(typeof LABS)[number] | undefined}
 */
export function getLab(slug) {
  return LABS.find((lab) => lab.slug === slug);
}
