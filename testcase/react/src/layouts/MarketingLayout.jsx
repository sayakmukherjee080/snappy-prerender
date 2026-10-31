import { Breadcrumbs } from '../components/Breadcrumbs.jsx';

/**
 * Wraps public detail pages with the shared breadcrumb rail.
 * @param {{ children: unknown }} props
 */
export function MarketingLayout({ children }) {
  return (
    <>
      <div className="shell marketing-breadcrumbs">
        <Breadcrumbs />
      </div>
      {children}
    </>
  );
}
