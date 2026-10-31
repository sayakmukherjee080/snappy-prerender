import { ContentSections } from '../../components/ContentSections.jsx';
import { PageIntro } from '../../components/PageIntro.jsx';
import { RelatedLinks } from '../../components/RelatedLinks.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { getSatellite } from '../../content/catalog/satellites.js';
import { useFeatureFlag, usePreferences } from '../../features/preferences/hooks.js';
import { useParams } from '../../router.jsx';
import NotFound from '../NotFound.jsx';

/**
 * Renders a satellite detail page with conditional telemetry and integration sections.
 */
export default function SatellitePage() {
  const { slug } = useParams();
  const satellite = getSatellite(slug);
  const preferences = usePreferences();
  const telemetryEnabled = useFeatureFlag('telemetry');

  if (!satellite) return <NotFound />;

  const sections = [
    {
      title: 'Mission',
      body: [satellite.summary, `Current milestone: ${satellite.milestone}.`],
    },
    {
      title: 'Node profile',
      stats: [
        { label: 'Plane', value: satellite.plane },
        { label: 'Orbit', value: satellite.orbit },
        { label: 'Mass', value: satellite.mass },
      ],
      list: [satellite.payload, satellite.vehicle, `Inclination ${satellite.inclination}`],
    },
    {
      title: 'Telemetry',
      when: 'active',
      flag: 'telemetry',
      body: [
        `Node load is ${satellite.utilization}% with the radiator at ${satellite.radiator}. The optical link is ${satellite.link}.`,
      ],
      stats: [
        { label: 'Load', value: `${satellite.utilization}%` },
        { label: 'Radiator', value: satellite.radiator },
        { label: 'Link', value: satellite.link },
      ],
    },
    {
      title: 'Integration state',
      when: 'planned',
      body: [
        `${satellite.name} is in the ${satellite.status.toLowerCase()} phase. ${satellite.summary}`,
      ],
      list: [
        'Thermal-vacuum qualification',
        'Launch window assignment',
        'Ground-segment acceptance',
      ],
    },
    {
      title: 'Flight note',
      variant: 'b',
      body: [
        'Variant B exposes the flight-note panel. It is a conditional section driven by the preference store, not by the route.',
      ],
    },
  ];

  return (
    <article className="detail-page">
      <PageIntro
        eyebrow={`Network / Satellites / ${satellite.id}`}
        title={satellite.name}
        summary={satellite.summary}
        meta={[
          { label: 'Plane', value: satellite.plane },
          { label: 'Status', value: satellite.status },
          { label: 'Launch', value: satellite.launch },
        ]}
        badge={{
          label: satellite.telemetry ? 'On orbit' : satellite.status,
          tone: satellite.telemetry ? 'success' : 'warning',
        }}
      />

      <div className="shell detail-grid">
        <div className="detail-main">
          {satellite.telemetry && telemetryEnabled && (
            <section className="satellite-telemetry" aria-label="Live-style telemetry">
              <div className="satellite-telemetry__head">
                <span className="mono-label">Node load</span>
                <StatusBadge
                  label={satellite.status}
                  tone={satellite.status === 'Nominal' ? 'success' : 'warning'}
                />
              </div>
              <div className="satellite-telemetry__value">{satellite.utilization}%</div>
              <span className="util__track" aria-hidden="true">
                <span className="util__bar" style={{ width: `${satellite.utilization}%` }} />
              </span>
              <div className="satellite-telemetry__grid">
                <div>
                  <span>Radiator</span>
                  <strong>{satellite.radiator}</strong>
                </div>
                <div>
                  <span>Optical link</span>
                  <strong>{satellite.link}</strong>
                </div>
                <div>
                  <span>Plane</span>
                  <strong>{satellite.plane}</strong>
                </div>
              </div>
            </section>
          )}

          <ContentSections sections={sections} record={satellite} preferences={preferences} />
        </div>

        <RelatedLinks
          links={[
            { label: 'Constellation', to: '/network/constellation' },
            { label: 'Telemetry', to: '/network/telemetry' },
            { label: 'Ground stations', to: '/network/ground-stations' },
          ]}
        />
      </div>
    </article>
  );
}
