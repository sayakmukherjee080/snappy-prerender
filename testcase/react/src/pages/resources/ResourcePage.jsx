import { DetailPage } from '../../components/DetailPage.jsx';
import { getResource } from '../../content/catalog/resources.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a resource page and its optional interactive widget.
 */
export default function ResourcePage() {
  const { slug } = useParams();
  const page = getResource(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={{ ...page, eyebrow: `Resources / ${page.title}` }} />;
}
