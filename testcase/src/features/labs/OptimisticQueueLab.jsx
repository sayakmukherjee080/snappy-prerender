import { useActionState, useOptimistic, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LabShell } from './LabShell.jsx';

/**
 * Renders a submit button that reads the parent form status.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button--orange" disabled={pending}>
      {pending ? 'Enqueueing…' : 'Enqueue request'}
    </button>
  );
}

/**
 * Demonstrates useActionState, useOptimistic, and useFormStatus in one form.
 */
export default function OptimisticQueueLab() {
  const [queue, setQueue] = useState([]);
  const [optimisticQueue, addOptimistic] = useOptimistic(queue, (state, item) => [...state, item]);

  /**
   * Validates the form, adds an optimistic item, and settles the queue after a delay.
   * @param {{ error: string | null, submitted: string | null }} previous
   * @param {FormData} formData
   * @returns {Promise<{ error: string | null, submitted: string | null }>}
   */
  async function enqueue(previous, formData) {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { error: 'Enter a request name.', submitted: previous.submitted };
    if (name.length > 40)
      return { error: 'Keep the name under 40 characters.', submitted: previous.submitted };

    addOptimistic({ name, pending: true });
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setQueue((current) => [...current, { name, pending: false }]);
    return { error: null, submitted: name };
  }

  const [state, formAction] = useActionState(enqueue, { error: null, submitted: null });

  return (
    <LabShell
      title="Optimistic queue"
      summary="An action-state form that renders the request immediately, then settles it after the server-shaped delay."
      tags={['useActionState', 'useOptimistic', 'useFormStatus']}
      notes={[
        'The optimistic row appears before the simulated action resolves.',
        'The submit button reads pending state from useFormStatus, not a prop.',
        'The settled queue is the source of truth after the transition.',
      ]}
    >
      <div className="lab-demo">
        <form className="lab-form" action={formAction}>
          <label className="lab-field">
            <span>Request name</span>
            <input
              type="text"
              name="name"
              maxLength={40}
              placeholder="e.g. apac-handoff-pilot"
              autoComplete="off"
            />
          </label>
          <SubmitButton />
          {state.error && <p className="field__error">{state.error}</p>}
          {state.submitted && <p className="lab-facts__line">Settled request: {state.submitted}</p>}
        </form>

        <div className="queue">
          <p className="mono-label">Queue</p>
          {optimisticQueue.length === 0 && <p className="widget-note">No requests yet.</p>}
          <ul>
            {optimisticQueue.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <span
                  className={`status-badge status-badge--${item.pending ? 'warning' : 'success'}`}
                >
                  {item.pending ? 'optimistic' : 'settled'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LabShell>
  );
}
