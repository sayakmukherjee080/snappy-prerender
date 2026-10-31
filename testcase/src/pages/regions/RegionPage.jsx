import { DetailPage } from '../../components/DetailPage.jsx';
import { getRegion } from '../../content/catalog/regions.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a region coverage page.
 */
export default function RegionPage() {
  const { slug } = useParams();
  const page = getRegion(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={{ ...page, eyebrow: `Regions / ${page.title}` }} />;
}
