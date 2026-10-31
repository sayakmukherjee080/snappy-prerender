import { SiteLayout } from '../components/SiteLayout.jsx';
import { useHiddenAccess } from '../features/hidden/hooks.js';
import { RouteView, useRouter } from '../router.jsx';
import { DocsLayout } from './DocsLayout.jsx';
import { LabLayout } from './LabLayout.jsx';
import { MarketingLayout } from './MarketingLayout.jsx';

/**
 * Selects the route layout and decides whether the shell is rendered at all.
 */
export function AppShell() {
  const { route, query } = useRouter();
  const hiddenUnlocked = useHiddenAccess();
  const isBare = query.get('embed') === '1' || query.get('print') === '1';

  if (isBare) return <RouteView />;

  if (route.layout === 'docs') {
    return (
      <SiteLayout>
        <DocsLayout>
          <RouteView />
        </DocsLayout>
      </SiteLayout>
    );
  }

  if (route.layout === 'lab' && hiddenUnlocked) {
    return (
      <SiteLayout>
        <LabLayout>
          <RouteView />
        </LabLayout>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <MarketingLayout>
        <RouteView />
      </MarketingLayout>
    </SiteLayout>
  );
}
