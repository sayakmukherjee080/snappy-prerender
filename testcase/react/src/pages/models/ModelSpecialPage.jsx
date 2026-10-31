import { DetailPage } from '../../components/DetailPage.jsx';
import { getModelSpecial } from '../../content/catalog/models.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders the compare, benchmarks, or deprecated model page.
 * @param {{ slug?: string }} props
 */
export default function ModelSpecialPage({ slug: slugProp }) {
  const params = useParams();
  const page = getModelSpecial(slugProp ?? params.slug);
  if (!page) return <NotFound />;
  return <DetailPage record={{ ...page, eyebrow: `Models / ${page.title}` }} />;
}
