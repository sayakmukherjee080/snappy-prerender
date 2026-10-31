import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { getStation } from '../../content/catalog/stations.js';
import { usePreferences } from '../../features/preferences/hooks.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a ground-station detail page.
 */
export default function StationPage() {
  const { slug } = useParams();
  const station = getStation(slug);
  const preferences = usePreferences();

  if (!station) return <NotFound />;

  const sections = [
    {
      title: 'Mission',
      body: [station.summary, `The station has been in service since ${station.since}.`],
    },
    {
      title: 'Ground segment',
      stats: [
        { label: 'Code', value: station.code },
        { label: 'Coordinates', value: station.coordinates },
        { label: 'Metro', value: station.metro },
      ],
      list: [
        station.antenna,
        `Uplink ${station.uplink}`,
        `p50 ${station.latency} ms to ${station.metro}`,
      ],
    },
    {
      title: 'Route profile',
      body: [
        `${station.name} hands traffic to ${station.metro} at a modeled p50 of ${station.latency} ms, including ground processing.`,
        station.highlight,
      ],
    },
    {
      title: 'Station note',
      variant: 'b',
      body: [
        'Variant B exposes the station note. The route is the same; only the conditional section changes.',
      ],
    },
  ];

  return (
    <article className="detail-page">
      <PageIntro
        eyebrow={`Network / Ground stations / ${station.code}`}
        title={station.name}
        summary={station.summary}
        meta={[
          { label: 'Metro', value: station.metro },
          { label: 'p50', value: `${station.latency} ms` },
          { label: 'Since', value: station.since },
        ]}
        badge={{ label: station.status, tone: 'success' }}
      />

      <div className="shell detail-grid">
        <div className="detail-main">
          <ContentSections sections={sections} record={station} preferences={preferences} />
        </div>
        <RelatedLinks
          links={[
            { label: 'All stations', to: '/network/ground-stations' },
            { label: 'Routes', to: '/network/routes' },
            { label: 'Constellation', to: '/network/constellation' },
          ]}
        />
      </div>
    </article>
  );
}
