import { Component } from 'react';
import { Link } from '../../router.jsx';
import { newsResource } from './newsResource.js';

/**
 * Catches a failed news request, resets the cached resource, and offers a retry.
 */
export class NewsBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  /**
   * Captures a rejected resource read.
   * @param {Error} error
   * @returns {{ error: Error }}
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * Clears the resource cache and the boundary so the page can fetch again.
   */
  retry() {
    newsResource.reset();
    newsResource.load();
    this.setState({ error: null });
  }

  /**
   * Renders the protected subtree or a generic source failure.
   * @returns {unknown}
   */
  render() {
    if (this.state.error) {
      return (
        <section className="api-error">
          <p className="eyebrow">API source</p>
          <h1>The source is not responding.</h1>
          <p className="lede">
            The Spaceflight News API did not return a valid response. Retry the source or return to
            the API index.
          </p>
          <div className="lab-controls">
            <button type="button" className="button button--orange" onClick={this.retry}>
              Retry source
            </button>
            <Link to="/api" className="button button--ghost">
              Back to API index
            </Link>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
