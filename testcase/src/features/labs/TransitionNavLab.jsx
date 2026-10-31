import { useTransition } from 'react';
import { useRouter } from '../../router.jsx';
import { LabShell } from './LabShell.jsx';

const TARGETS = [
  { label: 'Satellite 01', to: '/network/satellites/aether-01' },
  { label: 'Svalbard', to: '/network/ground-stations/svalbard' },
  { label: 'Model 70B', to: '/models/aether-70b-instruct' },
  { label: 'Docs quickstart', to: '/docs/guides/quickstart' },
  { label: 'Pricing estimator', to: '/pricing/estimator' },
  { label: 'Command palette', to: '/lab/command-palette' },
];

/**
 * Demonstrates prefetched navigation with a transition and a pending state.
 */
export default function TransitionNavLab() {
  const { path, navigate, prefetch } = useRouter();
  const [isPending, startTransition] = useTransition();

  /**
   * Navigates inside a transition so the pending state is visible.
   * @param {string} to
   */
  function go(to) {
    startTransition(() => navigate(to));
  }

  return (
    <LabShell
      title="Transition navigation"
      summary="Prefetch a lazy route on hover, navigate inside startTransition, and keep the old page visible while the chunk loads."
      tags={['useTransition', 'prefetch', 'startTransition']}
      notes={[
        'Hover a target to prefetch its route chunk.',
        'The pending state is visible while the transition is in flight.',
        'The current path is read from the external location store.',
      ]}
    >
      <div className="lab-demo">
        <p className="lab-facts__line">
          Current path: <code>{path}</code> · {isPending ? 'pending' : 'idle'}
        </p>
        <div className="transition-grid">
          {TARGETS.map((target) => (
            <button
              key={target.to}
              type="button"
              className="transition-card"
              onMouseEnter={() => prefetch(target.to)}
              onFocus={() => prefetch(target.to)}
              onClick={() => go(target.to)}
            >
              <span className="mono-label">Prefetched route</span>
              <strong>{target.label}</strong>
              <span>{target.to}</span>
            </button>
          ))}
        </div>
      </div>
    </LabShell>
  );
}
