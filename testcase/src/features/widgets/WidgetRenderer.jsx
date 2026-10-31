import { ContactForm } from '../company/ContactForm.jsx';
import { PricingCalculator } from '../pricing/PricingCalculator.jsx';
import { JobsList, TeamGrid } from './CompanyWidgets.jsx';
import { BenchmarkTable, DeprecatedModels, ModelCompareTable } from './ModelWidgets.jsx';
import {
  ConstellationWidget,
  HandoffWidget,
  LatencyWidget,
  StationTableWidget,
  TelemetryWidget,
} from './NetworkWidgets.jsx';
import { PricingCompareTable } from './PricingWidgets.jsx';
import {
  BrandKit,
  FaqWidget,
  GlossaryWidget,
  IncidentHistory,
  LaunchManifest,
  OrbitCalculator,
  ResidencyTable,
  StatusTable,
} from './ResourceWidgets.jsx';

const WIDGETS = {
  'pricing-calculator': PricingCalculator,
  'pricing-compare': PricingCompareTable,
  'team-grid': TeamGrid,
  'jobs-list': JobsList,
  'contact-form': ContactForm,
  faq: FaqWidget,
  glossary: GlossaryWidget,
  'status-table': StatusTable,
  'brand-kit': BrandKit,
  'launch-manifest': LaunchManifest,
  'orbit-calculator': OrbitCalculator,
  'residency-table': ResidencyTable,
  'incident-history': IncidentHistory,
  'model-compare': ModelCompareTable,
  'model-benchmarks': BenchmarkTable,
  'model-deprecated': DeprecatedModels,
  'constellation-map': ConstellationWidget,
  'station-table': StationTableWidget,
  'latency-chart': LatencyWidget,
  'handoff-steps': HandoffWidget,
  'telemetry-table': TelemetryWidget,
};

/**
 * Resolves a data page's widget key to its interactive component.
 * @param {{ widget?: string, record?: object }} props
 */
export function WidgetRenderer({ widget, record }) {
  if (!widget) return null;
  const Component = WIDGETS[widget];
  if (!Component) return null;

  return (
    <div className="widget">
      <Component record={record} />
    </div>
  );
}
