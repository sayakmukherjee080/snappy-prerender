import { Component } from 'react';

/**
 * Catches failures inside a single route and offers a reset instead of blanking the shell.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
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
   * Reports the route failure with its component stack.
   * @param {Error} error
   * @param {{ componentStack: string }} info
   */
  componentDidCatch(error, info) {
    console.error('Route render failed.', error, info.componentStack);
  }

  /**
   * Clears the boundary so the route can render again.
   */
  handleReset() {
    this.setState({ error: null });
  }

  /**
   * Renders the route or its recoverable fallback.
   * @returns {unknown}
   */
  render() {
    if (this.state.error) {
      return (
        <section className="route-error">
          <p className="eyebrow">Route fault</p>
          <h1>This route lost signal.</h1>
          <p>The page threw while rendering. Retry the route or return to the network map.</p>
          <div className="route-error__actions">
            <button type="button" className="button" onClick={this.handleReset}>
              Retry route
            </button>
            <a className="button button--ghost" href="/">
              Return home
            </a>
          </div>
          <pre className="route-error__detail">{String(this.state.error.message)}</pre>
        </section>
      );
    }

    return this.props.children;
  }
}
