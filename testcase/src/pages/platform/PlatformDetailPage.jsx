import { DetailPage } from '../../components/DetailPage.jsx';
import { getPlatformPage } from '../../content/catalog/platform.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a data-driven platform sub-page.
 */
export default function PlatformDetailPage() {
  const { slug } = useParams();
  const page = getPlatformPage(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={page} />;
}
