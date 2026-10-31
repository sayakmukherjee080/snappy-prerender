import { useState } from 'react';
import { flushSync } from 'react-dom';
import { usePrefersReducedMotion } from '../../hooks/useDom.js';
import { LabShell } from './LabShell.jsx';

/**
 * Demonstrates a feature-detected View Transition around a flushSync state change.
 */
export default function ViewTransitionsLab() {
  const [variant, setVariant] = useState('a');
  const reducedMotion = usePrefersReducedMotion();

  /**
   * Toggles the demo layout through the View Transitions API when available.
   */
  function toggle() {
    const update = () => setVariant((current) => (current === 'a' ? 'b' : 'a'));

    if (document.startViewTransition && !reducedMotion) {
      document.startViewTransition(() => {
        flushSync(update);
      });
    } else {
      update();
    }
  }

  return (
    <LabShell
      title="View transitions"
      summary="A feature-detected page transition with flushSync, a reduced-motion fallback, and no animation library."
      tags={['View Transitions', 'flushSync', 'prefers-reduced-motion']}
      notes={[
        'document.startViewTransition is feature-detected at click time.',
        'flushSync commits the React state change inside the transition callback.',
        'Reduced motion skips the transition and updates immediately.',
      ]}
    >
      <div className="lab-demo">
        <div className={`view-demo view-demo--${variant}`}>
          <div className="view-demo__panel view-demo__panel--one">
            <span className="mono-label">Panel A</span>
            <h2>Orbital route</h2>
            <p>Latency is a route, not a constant.</p>
          </div>
          <div className="view-demo__panel view-demo__panel--two">
            <span className="mono-label">Panel B</span>
            <h2>Ground fallback</h2>
            <p>Keep the terrestrial path warm until the cutover is proven.</p>
          </div>
        </div>
        <button type="button" className="button button--orange" onClick={toggle}>
          Toggle layout
        </button>
        <p className="lab-facts__line">
          Variant {variant.toUpperCase()} ·{' '}
          {typeof document !== 'undefined' && document.startViewTransition
            ? 'View Transitions available'
            : 'View Transitions unavailable'}{' '}
          · {reducedMotion ? 'reduced motion' : 'motion allowed'}
        </p>
      </div>
    </LabShell>
  );
}
