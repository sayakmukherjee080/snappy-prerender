import { DetailPage } from '../../components/DetailPage.jsx';
import { getPricingPage } from '../../content/catalog/pricing.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a data-driven pricing sub-page, including the estimator and comparison widgets.
 */
export default function PricingDetailPage() {
  const { slug } = useParams();
  const page = getPricingPage(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={page} />;
}
