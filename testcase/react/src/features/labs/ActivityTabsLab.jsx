import { Activity, useId, useState } from 'react';
import { LabShell } from './LabShell.jsx';

/**
 * A stateful panel used to prove that Activity preserves hidden state.
 * @param {{ label: string }} props
 */
function CounterPanel({ label }) {
  const [count, setCount] = useState(0);
  const [note, setNote] = useState('');

  return (
    <div className="activity-panel">
      <p className="mono-label">{label}</p>
      <div className="activity-counter">
        <strong>{count}</strong>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment
        </button>
      </div>
      <label className="lab-field">
        <span>Draft note</span>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Type something, switch tabs, come back."
        />
      </label>
    </div>
  );
}

/**
 * Demonstrates React 19.2 Activity state preservation across hidden tabs.
 */
export default function ActivityTabsLab() {
  const [active, setActive] = useState(null);
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <LabShell
      title="Activity tabs"
      summary="The hidden tab keeps its counter and draft text alive with the React 19.2 Activity component."
      tags={['Activity', 'state preservation', 'React 19.2']}
      notes={[
        'Activity keeps the hidden subtree mounted but hidden.',
        'Switch tabs, increment a counter, type a note, and return.',
        'This is different from conditional rendering, which would discard the state.',
      ]}
    >
      {active === null ? (
        <div className="lab-demo">
          <p className="widget-note">
            Activity mounts after hydration so the prerendered page can boot without it.
          </p>
          <button type="button" className="button button--orange" onClick={() => setActive('a')}>
            Start Activity demo
          </button>
        </div>
      ) : (
        <div className="lab-demo">
          <div className="tabs" role="tablist" aria-label="Activity panels">
            {['a', 'b'].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab}`}
                aria-selected={active === tab}
                aria-controls={`${baseId}-panel-${tab}`}
                tabIndex={active === tab ? 0 : -1}
                onClick={() => setActive(tab)}
              >
                Panel {tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div
            id={`${baseId}-panel-a`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-a`}
            hidden={active !== 'a'}
          >
            <Activity mode={active === 'a' ? 'visible' : 'hidden'}>
              <CounterPanel label="Panel A" />
            </Activity>
          </div>

          <div
            id={`${baseId}-panel-b`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-b`}
            hidden={active !== 'b'}
          >
            <Activity mode={active === 'b' ? 'visible' : 'hidden'}>
              <CounterPanel label="Panel B" />
            </Activity>
          </div>
        </div>
      )}
    </LabShell>
  );
}
