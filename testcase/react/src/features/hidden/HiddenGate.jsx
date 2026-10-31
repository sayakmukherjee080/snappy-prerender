import { useId, useState } from 'react';
import { DEMO_UNLOCK_CODE, hiddenStore } from './store.js';

/**
 * Renders the demo unlock gate shown when an unlisted lab route is opened without access.
 */
export function HiddenGate() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const inputId = useId();

  /**
   * Attempts to unlock the lab with the submitted demo code.
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  function handleSubmit(event) {
    event.preventDefault();
    if (!hiddenStore.unlock(code)) {
      setError('That code does not match the demo gate.');
      return;
    }
    setError('');
  }

  return (
    <section className="hidden-gate">
      <div className="shell hidden-gate__inner">
        <p className="eyebrow">
          <span className="eyebrow__index">00</span>
          Unlisted lab
        </p>
        <h1>This route is not on the map.</h1>
        <p className="lede">
          The lab is unlisted and demo-gated. It is not a security boundary; it exists to keep the
          experimental routes out of the public navigation.
        </p>

        <form className="hidden-gate__form" onSubmit={handleSubmit}>
          <label htmlFor={inputId}>Demo access code</label>
          <div className="hidden-gate__row">
            <input
              id={inputId}
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setError('');
              }}
              autoComplete="off"
              spellCheck="false"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            <button type="submit" className="button button--orange">
              Unlock lab
            </button>
          </div>
          {error && (
            <span className="field__error" id={`${inputId}-error`}>
              {error}
            </span>
          )}
        </form>

        <p className="hidden-gate__hint">
          Demo hint: <code>{DEMO_UNLOCK_CODE}</code> · append{' '}
          <code>?unlock={DEMO_UNLOCK_CODE}</code> to any URL to open it directly.
        </p>
      </div>
    </section>
  );
}
