import { useInsertionEffect, useState } from 'react';
import { LabShell } from './LabShell.jsx';

/**
 * Demonstrates useInsertionEffect by injecting a scoped CSS variable before layout effects run.
 */
export default function InsertionThemeLab() {
  const [hue, setHue] = useState(24);

  useInsertionEffect(() => {
    const style = document.createElement('style');
    style.textContent = `.insertion-demo { --lab-hue: ${hue}; }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [hue]);

  return (
    <LabShell
      title="Insertion theme"
      summary="A runtime CSS variable injected with useInsertionEffect and removed on every change."
      tags={['useInsertionEffect', 'CSS variables', 'style injection']}
      notes={[
        'useInsertionEffect runs before layout effects, which is the right time for style injection.',
        'The style element is removed on every change and on unmount.',
        'The demo card reads the injected variable; no React re-render is needed for the paint.',
      ]}
    >
      <div className="lab-demo">
        <div className="insertion-demo">
          <span className="mono-label">Runtime theme</span>
          <h2>Hue {hue}°</h2>
          <p>The card border and accent read from an injected CSS variable.</p>
        </div>
        <label className="lab-range">
          <span>Hue · {hue}°</span>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={hue}
            onChange={(event) => setHue(Number(event.target.value))}
          />
        </label>
      </div>
    </LabShell>
  );
}
