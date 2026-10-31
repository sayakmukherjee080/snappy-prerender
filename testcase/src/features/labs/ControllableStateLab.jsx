import { useCallback, useDebugValue, useState } from 'react';
import { LabShell } from './LabShell.jsx';

/**
 * Supports a component that can be controlled or uncontrolled.
 * @param {{ value?: number, defaultValue?: number, onChange?: (value: number) => void }} options
 * @returns {[number, (value: number) => void]}
 */
function useControllableState({ value, defaultValue = 0, onChange }) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const setValue = useCallback(
    (next) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  useDebugValue(isControlled ? `controlled: ${current}` : `uncontrolled: ${current}`);
  return [current, setValue];
}

/**
 * Renders a counter through the controllable-state hook.
 * @param {{ value?: number, defaultValue?: number, onChange?: (value: number) => void }} props
 */
function Counter({ value, defaultValue, onChange }) {
  const [count, setCount] = useControllableState({ value, defaultValue, onChange });

  return (
    <div className="controllable-counter">
      <span className="mono-label">Counter</span>
      <strong>{count}</strong>
      <div className="lab-controls">
        <button type="button" className="button button--ghost" onClick={() => setCount(count - 1)}>
          Decrement
        </button>
        <button type="button" className="button button--orange" onClick={() => setCount(count + 1)}>
          Increment
        </button>
      </div>
    </div>
  );
}

/**
 * Demonstrates one component that works controlled or uncontrolled.
 */
export default function ControllableStateLab() {
  const [controlled, setControlled] = useState(false);
  const [value, setValue] = useState(3);

  return (
    <LabShell
      title="Controllable state"
      summary="One counter that works controlled or uncontrolled through a small useControllableState hook."
      tags={['useControllableState', 'controlled', 'uncontrolled', 'useDebugValue']}
      notes={[
        'Uncontrolled mode keeps its own state; controlled mode reads the parent value.',
        'The hook labels the mode in React DevTools.',
        'Switching modes preserves the last parent value when controlled.',
      ]}
    >
      <div className="lab-demo">
        <div className="lab-controls">
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={controlled}
            onClick={() => setControlled((current) => !current)}
          >
            {controlled ? 'Make uncontrolled' : 'Make controlled'}
          </button>
          <button type="button" className="button" onClick={() => setValue(3)}>
            Reset parent value
          </button>
        </div>
        <p className="lab-facts__line">
          Mode: {controlled ? 'controlled' : 'uncontrolled'} · parent value: {value}
        </p>
        <Counter value={controlled ? value : undefined} defaultValue={0} onChange={setValue} />
      </div>
    </LabShell>
  );
}
