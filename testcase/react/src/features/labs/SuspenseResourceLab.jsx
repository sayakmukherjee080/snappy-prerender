import { Component, Suspense, use, useState } from 'react';
import { createResource } from '../../lib/resource.js';
import { LabShell } from './LabShell.jsx';

const resource = createResource(async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 900));
  return {
    generatedAt: new Date().toISOString(),
    nodes: 24,
    p50: 18,
    note: 'A cached promise read with use() inside a Suspense boundary.',
  };
});

// Preload once outside render so use() receives the cached promise.
resource.load();

/**
 * A resettable boundary for the suspense resource demo.
 */
class ResourceBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  /**
   * Captures a rejected resource.
   * @param {Error} error
   * @returns {{ error: Error }}
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * Resets the resource and the boundary so the child can try again.
   */
  retry() {
    resource.reset();
    resource.load();
    this.setState({ error: null });
  }

  /**
   * Renders the child or the retry fallback.
   * @returns {unknown}
   */
  render() {
    if (this.state.error) {
      return (
        <div className="fault-panel fault-panel--error">
          <p className="mono-label">Resource rejected</p>
          <h3>{this.state.error.message}</h3>
          <button type="button" className="button button--ghost" onClick={this.retry}>
            Retry resource
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Reads the resource with use() and renders the result.
 */
function ResourceView() {
  const data = use(resource.load());
  return (
    <dl className="lab-facts">
      <div>
        <dt>Nodes</dt>
        <dd>{data.nodes}</dd>
      </div>
      <div>
        <dt>p50</dt>
        <dd>{data.p50} ms</dd>
      </div>
      <div>
        <dt>Generated</dt>
        <dd>{data.generatedAt}</dd>
      </div>
    </dl>
  );
}

/**
 * Demonstrates use() with a cached promise, a suspense fallback, and a retry boundary.
 */
export default function SuspenseResourceLab() {
  const [version, setVersion] = useState(0);

  /**
   * Clears the resource cache and remounts the reader.
   */
  function refresh() {
    resource.reset();
    resource.load();
    setVersion((current) => current + 1);
  }

  return (
    <LabShell
      title="Suspense resource"
      summary="A cached promise read with use(), a skeleton fallback, and an error boundary with retry."
      tags={['use', 'Suspense', 'ErrorBoundary', 'resource cache']}
      notes={[
        'The first render suspends on the cached promise.',
        'Refresh clears the cache and remounts the reader.',
        'A rejected promise is caught by the boundary and can be retried.',
      ]}
    >
      <div className="lab-demo">
        <div className="lab-controls">
          <button type="button" className="button button--orange" onClick={refresh}>
            Refresh resource
          </button>
          <span className="lab-facts__line">Read {version + 1}</span>
        </div>

        <ResourceBoundary>
          <Suspense
            fallback={
              <div className="suspense-skeleton" aria-busy="true">
                <span />
                <span />
                <span />
              </div>
            }
          >
            <ResourceView key={version} />
          </Suspense>
        </ResourceBoundary>
      </div>
    </LabShell>
  );
}
