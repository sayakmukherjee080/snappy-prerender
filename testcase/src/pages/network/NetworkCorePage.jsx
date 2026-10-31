import { DetailPage } from '../../components/DetailPage.jsx';
import { getNetworkCorePage } from '../../content/catalog/networkCore.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders one of the five network core pages: constellation, ground, routes, handoff, or telemetry.
 */
export default function NetworkCorePage() {
  const { slug } = useParams();
  const page = getNetworkCorePage(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={page} />;
}
