import { useHiddenAccess } from '../hidden/hooks.js';
import { usePalette } from '../palette/PaletteProvider.jsx';
import { useFeatureFlag } from '../preferences/hooks.js';
import { LabShell } from './LabShell.jsx';

/**
 * Demonstrates the global command palette and the preferences it exposes.
 */
export default function CommandPaletteLab() {
  const { openPalette } = usePalette();
  const hiddenUnlocked = useHiddenAccess();
  const showHidden = useFeatureFlag('showHidden');
  const telemetry = useFeatureFlag('telemetry');

  return (
    <LabShell
      title="Command palette"
      summary="A single portal-mounted dialog with deferred search, a focus trap, an inert app root, and keyboard navigation."
      tags={['createPortal', 'useDeferredValue', 'useEffectEvent', 'inert']}
      notes={[
        'The palette is mounted once at the app root, not per page.',
        'Search is deferred so typing stays responsive while the route list filters.',
        'The app root is marked inert while the dialog is open.',
      ]}
    >
      <div className="lab-demo">
        <button type="button" className="button button--orange" onClick={openPalette}>
          Open command palette <kbd>⌘K</kbd>
        </button>
        <dl className="lab-facts">
          <div>
            <dt>Hidden routes unlocked</dt>
            <dd>{hiddenUnlocked ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Show hidden in palette</dt>
            <dd>{showHidden ? 'On' : 'Off'}</dd>
          </div>
          <div>
            <dt>Telemetry sections</dt>
            <dd>{telemetry ? 'On' : 'Off'}</dd>
          </div>
        </dl>
        <p className="widget-note">
          Open the palette and search for “satellite”, “docs”, or “lab”. The hidden lab routes only
          appear after the demo gate is unlocked and the hidden toggle is on.
        </p>
      </div>
    </LabShell>
  );
}
