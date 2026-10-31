import { Component } from 'react';

/**
 * Catches unexpected render failures and shows a recoverable fallback instead of a blank page.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Switches the boundary into its fallback state when a descendant throws.
   * @returns {{ hasError: boolean }}
   */
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  /**
   * Reports the render failure with its component stack for local diagnosis.
   * @param {Error} error
   * @param {{ componentStack: string }} info
   */
  componentDidCatch(error, info) {
    console.error('Aether site render failed.', error, info.componentStack);
  }

  /**
   * Renders the fallback or the protected subtree.
   * @returns {unknown}
   */
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-page">
          <p className="eyebrow">System fault</p>
          <h1>This page lost signal.</h1>
          <p>Reload to reconnect. If the fault repeats, the issue is on our side.</p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
