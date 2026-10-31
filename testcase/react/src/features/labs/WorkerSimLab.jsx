import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { LabShell } from './LabShell.jsx';

const INITIAL = { status: 'idle', progress: 0, results: [], summary: null };

/**
 * Reduces worker progress and result messages into a single UI state.
 * @param {typeof INITIAL} state
 * @param {{ type: string, value?: number, results?: object[], summary?: object }} action
 * @returns {typeof INITIAL}
 */
function reducer(state, action) {
  if (action.type === 'start') return { ...INITIAL, status: 'running' };
  if (action.type === 'progress') return { ...state, progress: action.value ?? state.progress };
  if (action.type === 'done') {
    return {
      status: 'done',
      progress: 100,
      results: action.results ?? [],
      summary: action.summary ?? null,
    };
  }
  if (action.type === 'reset') return INITIAL;
  return state;
}

/**
 * Demonstrates a Vite module worker streaming route simulations off the main thread.
 */
export default function WorkerSimLab() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [count, setCount] = useState(240);
  const workerRef = useRef(null);

  const handleMessage = useEffectEvent((event) => {
    const message = event.data;
    if (message.type === 'progress') dispatch({ type: 'progress', value: message.value });
    if (message.type === 'done') {
      dispatch({ type: 'done', results: message.results, summary: message.summary });
    }
  });

  useEffect(() => {
    const worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const listener = (event) => handleMessage(event);
    worker.addEventListener('message', listener);
    return () => {
      worker.removeEventListener('message', listener);
      worker.terminate();
      workerRef.current = null;
    };
  }, [handleMessage]);

  /**
   * Starts a worker run with the selected route count.
   */
  function run() {
    if (!workerRef.current) return;
    dispatch({ type: 'start' });
    workerRef.current.postMessage({ type: 'run', count, seed: 11 });
  }

  return (
    <LabShell
      title="Worker simulator"
      summary="A Vite module worker computes route simulations while the main thread stays interactive."
      tags={['Web Worker', 'useReducer', 'useEffectEvent']}
      notes={[
        'The worker is created with new URL(..., import.meta.url) and type: module.',
        'Progress messages are reduced into one state object.',
        'The worker is terminated on unmount; no task survives the page.',
      ]}
    >
      <div className="lab-demo">
        <div className="lab-controls">
          <label className="lab-range">
            <span>Routes · {count}</span>
            <input
              type="range"
              min="60"
              max="600"
              step="20"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            />
          </label>
          <button type="button" className="button button--orange" onClick={run}>
            Run simulation
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => dispatch({ type: 'reset' })}
          >
            Reset
          </button>
        </div>

        <div className="worker-progress" aria-live="polite">
          <span>{state.status}</span>
          <span>{state.progress}%</span>
        </div>
        <div className="worker-progress__track" aria-hidden="true">
          <span style={{ width: `${state.progress}%` }} />
        </div>

        {state.summary && (
          <dl className="lab-facts">
            <div>
              <dt>Routes</dt>
              <dd>{state.summary.count}</dd>
            </div>
            <div>
              <dt>p50</dt>
              <dd>{state.summary.p50} ms</dd>
            </div>
            <div>
              <dt>Best</dt>
              <dd>{state.summary.best} ms</dd>
            </div>
          </dl>
        )}

        {state.results.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <caption>Fastest simulated routes</caption>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Latency</th>
                  <th scope="col">Handoffs</th>
                </tr>
              </thead>
              <tbody>
                {state.results.map((result) => (
                  <tr key={result.route}>
                    <td className="mono-cell">{result.route}</td>
                    <td className="mono-cell">{result.latency} ms</td>
                    <td className="mono-cell">{result.handoffs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LabShell>
  );
}
