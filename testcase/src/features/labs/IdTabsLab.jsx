import { useId, useRef, useState } from 'react';
import { LabShell } from './LabShell.jsx';

const TABS = [
  {
    id: 'route',
    label: 'Route',
    body: 'A route is the path a request takes from the ground relay to the node and back.',
  },
  {
    id: 'handoff',
    label: 'Handoff',
    body: 'A handoff mirrors state to the next node before the current one loses the horizon.',
  },
  {
    id: 'telemetry',
    label: 'Telemetry',
    body: 'Telemetry is the measured state of the node, not a promise about the network.',
  },
];

/**
 * Demonstrates useId with accessible tabs and roving tabindex.
 */
export default function IdTabsLab() {
  const [active, setActive] = useState(TABS[0].id);
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tabRefs = useRef([]);

  /**
   * Moves focus and selection with the arrow keys.
   * @param {React.KeyboardEvent<HTMLButtonElement>} event
   * @param {number} index
   */
  function handleKeyDown(event, index) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + direction + TABS.length) % TABS.length;
    setActive(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <LabShell
      title="ID tabs"
      summary="Accessible tabs with useId, roving tabindex, and arrow-key navigation."
      tags={['useId', 'ARIA tabs', 'roving tabindex']}
      notes={[
        'useId generates stable tab and panel IDs without a global counter.',
        'Only the active tab is in the tab order; arrow keys move between tabs.',
        'The panel is labelled by its tab and controls are linked both ways.',
      ]}
    >
      <div className="lab-demo">
        <div className="tabs" role="tablist" aria-label="Glossary terms">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {TABS.map((tab) => (
          <div
            key={tab.id}
            id={`${baseId}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={active !== tab.id}
            className="tab-panel"
          >
            <h2>{tab.label}</h2>
            <p>{tab.body}</p>
          </div>
        ))}
      </div>
    </LabShell>
  );
}
