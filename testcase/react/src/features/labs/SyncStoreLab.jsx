import { setFeatureFlag, setVariant, usePreferences } from '../preferences/hooks.js';
import { preferencesStore } from '../preferences/store.js';
import { LabShell } from './LabShell.jsx';

/**
 * Demonstrates the external preference store, cross-tab sync, and URL flag overrides.
 */
export default function SyncStoreLab() {
  const preferences = usePreferences();

  return (
    <LabShell
      title="Sync store"
      summary="One external store drives flags, variants, and cross-tab sync without a context provider."
      tags={['useSyncExternalStore', 'BroadcastChannel', 'localStorage']}
      notes={[
        'Open a second tab and toggle a flag; both tabs update through BroadcastChannel.',
        'URL flags override the stored state on load: ?flags=telemetry,-experimental&variant=b.',
        'The store snapshot is immutable and read through useSyncExternalStore.',
      ]}
    >
      <div className="lab-demo">
        <div className="lab-controls lab-controls--wrap">
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={preferences.flags.telemetry}
            onClick={() => setFeatureFlag('telemetry', !preferences.flags.telemetry)}
          >
            Telemetry {preferences.flags.telemetry ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={preferences.flags.experimental}
            onClick={() => setFeatureFlag('experimental', !preferences.flags.experimental)}
          >
            Experimental {preferences.flags.experimental ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={preferences.flags.compact}
            onClick={() => setFeatureFlag('compact', !preferences.flags.compact)}
          >
            Compact {preferences.flags.compact ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setVariant(preferences.variant === 'a' ? 'b' : 'a')}
          >
            Variant {preferences.variant.toUpperCase()}
          </button>
          <button type="button" className="button" onClick={() => preferencesStore.reset()}>
            Reset
          </button>
        </div>

        <pre className="inline-code">{JSON.stringify(preferences, null, 2)}</pre>
        <p className="widget-note">
          This store is also used by the command palette, the satellite pages, and the conditional
          sections on the site.
        </p>
      </div>
    </LabShell>
  );
}
