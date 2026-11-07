import { Component, useState } from 'react';
import { LabShell } from './LabShell.jsx';

/**
 * A resettable error boundary used by the fault-injection demo.
 */
class DemoBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  /**
   * Captures a descendant render error.
   * @param {Error} error
   * @returns {{ error: Error }}
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * Clears the captured error.
   */
  reset() {
    this.setState({ error: null });
  }

  /**
   * Renders the protected subtree or the boundary fallback.
   * @returns {unknown}
   */
  render() {
    if (this.state.error) {
      return (
        <div className="fault-panel fault-panel--error">
          <p className="mono-label">{this.props.label} boundary caught</p>
          <h3>{this.state.error.message}</h3>
          <button type="button" className="button button--ghost" onClick={this.reset}>
            Reset boundary
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Throws on render when its flag is enabled.
 * @param {{ label: string, shouldThrow: boolean }} props
 */
function FaultyPanel({ label, shouldThrow }) {
  if (shouldThrow) throw new Error(`${label} panel threw during render.`);
  return (
    <div className="fault-panel">
      <p className="mono-label">{label} panel</p>
      <h3>Healthy render</h3>
      <p>This panel is inside its own error boundary.</p>
    </div>
  );
}

/**
 * Demonstrates nested error boundaries, fault injection, and local resets.
 */
export default function ErrorBoundariesLab() {
  const [outerThrow, setOuterThrow] = useState(false);
  const [innerThrow, setInnerThrow] = useState(false);

  return (
    <LabShell
      title="Error boundaries"
      summary="Nested boundaries isolate a failure to the smallest useful part of the page."
      tags={['ErrorBoundary', 'reset', 'fault injection']}
      notes={[
        'The inner boundary catches the inner fault without blanking the outer panel.',
        'The outer boundary catches a fault that escapes the inner subtree.',
        'Reset clears the boundary state; the faulty flag is still controlled by the page.',
      ]}
    >
      <div className="lab-demo">
        <div className="lab-controls">
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={innerThrow}
            onClick={() => setInnerThrow((value) => !value)}
          >
            {innerThrow ? 'Heal inner panel' : 'Throw inner panel'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={outerThrow}
            onClick={() => setOuterThrow((value) => !value)}
          >
            {outerThrow ? 'Heal outer panel' : 'Throw outer panel'}
          </button>
        </div>

        <DemoBoundary label="Outer">
          <FaultyPanel label="Outer" shouldThrow={outerThrow} />
          <DemoBoundary label="Inner">
            <FaultyPanel label="Inner" shouldThrow={innerThrow} />
          </DemoBoundary>
        </DemoBoundary>
      </div>
    </LabShell>
  );
}
