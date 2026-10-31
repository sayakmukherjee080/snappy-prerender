import { DetailPage } from '../../components/DetailPage.jsx';
import { getSolution } from '../../content/catalog/solutions.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders an industry solution page.
 */
export default function SolutionPage() {
  const { slug } = useParams();
  const page = getSolution(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={{ ...page, eyebrow: `Solutions / ${page.title}` }} />;
}
