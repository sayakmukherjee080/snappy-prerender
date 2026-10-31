import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { LabShell } from './LabShell.jsx';

/**
 * Demonstrates useEffectEvent for interval and keyboard listeners that read fresh state.
 */
export default function EffectEventLab() {
  const [count, setCount] = useState(0);
  const [log, setLog] = useState([]);
  const nextId = useRef(1);

  const record = useEffectEvent((message) => {
    setLog((current) => [{ id: nextId.current++, message }, ...current].slice(0, 6));
  });

  const tick = useEffectEvent(() => {
    setCount((current) => current + 1);
    record(`tick · count ${count}`);
  });

  const onKeyDown = useEffectEvent((event) => {
    if (event.key.toLowerCase() === 'a') record(`key · ${event.key.toUpperCase()}`);
  });

  useEffect(() => {
    const interval = window.setInterval(() => tick(), 1000);
    const listener = (event) => onKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', listener);
    };
  }, [onKeyDown, tick]);

  return (
    <LabShell
      title="Effect event"
      summary="An interval and a keyboard listener read fresh state without re-subscribing on every render."
      tags={['useEffectEvent', 'useEffect', 'stale closures']}
      notes={[
        'The effect subscribes once; the event handlers still see the latest count.',
        'Press “A” on the keyboard to append a key event.',
        'The log is capped so the demo stays readable.',
      ]}
    >
      <div className="lab-demo">
        <div className="effect-counter">
          <span className="mono-label">Ticks</span>
          <strong>{count}</strong>
        </div>
        <button type="button" className="button button--ghost" onClick={() => setLog([])}>
          Clear log
        </button>
        <ul className="event-log">
          {log.map((entry, index) => (
            <li key={entry.id}>
              <span className="mono-label">{String(index + 1).padStart(2, '0')}</span>
              {entry.message}
            </li>
          ))}
        </ul>
      </div>
    </LabShell>
  );
}
