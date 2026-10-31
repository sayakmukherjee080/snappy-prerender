import { DetailPage } from '../../components/DetailPage.jsx';
import { getCompanyPage } from '../../content/catalog/company.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a data-driven company sub-page, including team, jobs, and contact widgets.
 */
export default function CompanyDetailPage() {
  const { slug } = useParams();
  const page = getCompanyPage(slug);
  if (!page) return <NotFound />;
  return <DetailPage record={page} />;
}
