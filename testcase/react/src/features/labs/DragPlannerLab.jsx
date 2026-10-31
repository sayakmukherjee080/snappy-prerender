import { useId, useOptimistic, useReducer, useState, useTransition } from 'react';
import { SATELLITES } from '../../content/catalog/satellites.js';
import { LabShell } from './LabShell.jsx';

const SLOTS = ['P1', 'P2', 'P3'];
const NODES = SATELLITES.filter((satellite) => satellite.telemetry);

/**
 * Reduces slot assignments for the drag planner.
 * @param {Record<string, string | null>} state
 * @param {{ type: string, slot?: string, id?: string | null }} action
 * @returns {Record<string, string | null>}
 */
function plannerReducer(state, action) {
  if (action.type === 'assign' && action.slot) {
    return { ...state, [action.slot]: action.id ?? null };
  }
  if (action.type === 'clear' && action.slot) {
    return { ...state, [action.slot]: null };
  }
  return state;
}

/**
 * Demonstrates pointer-driven drag and drop with a reducer and an optimistic commit.
 */
export default function DragPlannerLab() {
  const [assignments, dispatch] = useReducer(plannerReducer, {
    P1: 'aether-01',
    P2: null,
    P3: 'aether-05',
  });
  const [saved, setSaved] = useState(assignments);
  const [optimistic, addOptimistic] = useOptimistic(saved, (_state, next) => next);
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(null);
  const slotId = useId();

  /**
   * Commits the current plan optimistically, then settles it after a simulated save.
   */
  function commit() {
    startTransition(async () => {
      addOptimistic(assignments);
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setSaved(assignments);
    });
  }

  return (
    <LabShell
      title="Drag planner"
      summary="A pointer-driven capacity planner with a reducer state machine and an optimistic save."
      tags={['useReducer', 'useOptimistic', 'useTransition', 'HTML drag and drop']}
      notes={[
        'Drag a node into a plane slot; the reducer is the only writer.',
        'Commit shows the optimistic plan while the simulated save resolves.',
        'The saved state is the fallback if the transition is interrupted.',
      ]}
    >
      <div className="lab-demo">
        <div className="planner">
          <div className="planner__nodes">
            <p className="mono-label">Available nodes</p>
            {NODES.map((node) => (
              <button
                type="button"
                className="planner__node"
                key={node.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', node.slug);
                  setDragging(node.slug);
                }}
                onDragEnd={() => setDragging(null)}
              >
                {node.id}
                <span>{node.plane}</span>
              </button>
            ))}
          </div>

          <div className="planner__slots">
            {SLOTS.map((slot) => {
              const assigned = optimistic[slot];
              const node = NODES.find((item) => item.slug === assigned);
              return (
                <fieldset
                  className={`planner__slot${node ? ' planner__slot--filled' : ''}`}
                  key={slot}
                  aria-label={`${slot} slot`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData('text/plain');
                    if (id) dispatch({ type: 'assign', slot, id });
                    setDragging(null);
                  }}
                >
                  <span className="mono-label">{slot}</span>
                  {node ? (
                    <>
                      <strong>{node.id}</strong>
                      <button
                        type="button"
                        className="planner__clear"
                        onClick={() => dispatch({ type: 'clear', slot })}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="planner__empty">Drop a node here</span>
                  )}
                </fieldset>
              );
            })}
          </div>
        </div>

        <div className="lab-controls">
          <button
            type="button"
            className="button button--orange"
            onClick={commit}
            disabled={isPending}
          >
            {isPending ? 'Saving plan…' : 'Commit plan'}
          </button>
          <span className="lab-facts__line" id={slotId}>
            {dragging ? `Dragging ${dragging}` : 'Drag a node'} ·{' '}
            {isPending ? 'optimistic' : 'settled'}
          </span>
        </div>
      </div>
    </LabShell>
  );
}
