import { useDebugValue, useEffect, useState } from 'react';
import { LabShell } from './LabShell.jsx';

/**
 * Returns the browser online state and labels it for React DevTools.
 * @returns {boolean}
 */
function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useDebugValue(online ? 'online' : 'offline');
  return online;
}

/**
 * Returns the viewport width and labels it for React DevTools.
 * @returns {number}
 */
function useWindowWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useDebugValue(`${width}px`);
  return width;
}

/**
 * Demonstrates useDebugValue on two small custom hooks.
 */
export default function DebugValueLab() {
  const online = useOnlineStatus();
  const width = useWindowWidth();

  return (
    <LabShell
      title="Debug value"
      summary="Custom hooks that label themselves in React DevTools without adding a visible debug UI."
      tags={['useDebugValue', 'custom hooks', 'React DevTools']}
      notes={[
        'Open React DevTools and select the DebugValueLab component.',
        'The Hooks panel shows “online” and the viewport width next to the hook names.',
        'useDebugValue only runs when DevTools is inspecting the component.',
      ]}
    >
      <div className="lab-demo">
        <dl className="lab-facts">
          <div>
            <dt>Network</dt>
            <dd>{online ? 'Online' : 'Offline'}</dd>
          </div>
          <div>
            <dt>Viewport</dt>
            <dd>{width} px</dd>
          </div>
          <div>
            <dt>Hooks</dt>
            <dd>useOnlineStatus · useWindowWidth</dd>
          </div>
        </dl>
        <p className="widget-note">
          Toggle your network connection or resize the window. The values update, but the point of
          the demo is what React DevTools shows for the hooks.
        </p>
      </div>
    </LabShell>
  );
}
