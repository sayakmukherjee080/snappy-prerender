import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { LABS } from '../content/catalog/labs.js';
import { hiddenStore } from '../features/hidden/store.js';
import { Link, useRouter } from '../router.jsx';

/**
 * Wraps unlisted lab pages with the lab navigation and the lock control.
 * @param {{ children: unknown }} props
 */
export function LabLayout({ children }) {
  const { path } = useRouter();

  return (
    <div className="lab-frame">
      <aside className="lab-sidebar">
        <div className="lab-sidebar__head">
          <p className="mono-label">Unlisted lab</p>
          <span className="status-badge status-badge--warning">Demo</span>
        </div>
        <p className="lab-sidebar__note">
          These routes are not in the public navigation. The gate is a demo, not a security
          boundary.
        </p>
        <nav className="lab-nav" aria-label="Lab routes">
          <Link to="/lab" aria-current={path === '/lab' ? 'page' : undefined}>
            Lab index
          </Link>
          {LABS.map((lab) => (
            <Link
              key={lab.slug}
              to={`/lab/${lab.slug}`}
              aria-current={path === `/lab/${lab.slug}` ? 'page' : undefined}
            >
              {lab.title}
            </Link>
          ))}
        </nav>
        <button type="button" className="text-link lab-lock" onClick={() => hiddenStore.lock()}>
          Lock lab <span aria-hidden="true">↺</span>
        </button>
      </aside>

      <div className="lab-content">
        <Breadcrumbs />
        {children}
      </div>
    </div>
  );
}
