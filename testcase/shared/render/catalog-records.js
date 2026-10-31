import { getCompanyPage } from '../content/catalog/company.js';
import { getNetworkCorePage } from '../content/catalog/networkCore.js';
import { getPlatformPage } from '../content/catalog/platform.js';
import { getPricingPage } from '../content/catalog/pricing.js';
import { getRegion } from '../content/catalog/regions.js';
import { getResource } from '../content/catalog/resources.js';
import { getSatellite } from '../content/catalog/satellites.js';
import { getSolution } from '../content/catalog/solutions.js';
import { getStation } from '../content/catalog/stations.js';
import { contentSections, detailPage, esc, pageIntro, relatedLinks, statusBadge } from './base.js';

export function regionPage(slug) {
  const page = getRegion(slug);
  if (!page) return notFoundPage();
  return detailPage({ ...page, eyebrow: `Regions / ${page.title}` });
}

/**
 * Renders the resources index.
 * @returns {string}
 */

export function resourcePage(slug) {
  const page = getResource(slug);
  if (!page) return notFoundPage();
  return detailPage({ ...page, eyebrow: `Resources / ${page.title}` });
}

/**
 * Renders the solutions index.
 * @returns {string}
 */

export function solutionPage(slug) {
  const page = getSolution(slug);
  if (!page) return notFoundPage();
  return detailPage({ ...page, eyebrow: `Solutions / ${page.title}` });
}

/**
 * Renders a platform detail page.
 * @param {string} slug
 * @returns {string}
 */
export function platformDetailPage(slug) {
  const page = getPlatformPage(slug);
  if (!page) return notFoundPage();
  return detailPage(page);
}

/**
 * Renders a pricing detail page.
 * @param {string} slug
 * @returns {string}
 */
export function pricingDetailPage(slug) {
  const page = getPricingPage(slug);
  if (!page) return notFoundPage();
  return detailPage(page);
}

/**
 * Renders a company detail page.
 * @param {string} slug
 * @returns {string}
 */
export function companyDetailPage(slug) {
  const page = getCompanyPage(slug);
  if (!page) return notFoundPage();
  return detailPage(page);
}

/**
 * Renders one of the network core pages.
 * @param {string} slug
 * @returns {string}
 */
export function networkCorePage(slug) {
  const page = getNetworkCorePage(slug);
  if (!page) return notFoundPage();
  return detailPage(page);
}

/**
 * Renders a satellite detail page.
 * @param {string} slug
 * @returns {string}
 */
export function satellitePage(slug) {
  const satellite = getSatellite(slug);
  if (!satellite) return notFoundPage();
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

  return `<article class="detail-page">
  ${pageIntro({
    eyebrow: `Network / Satellites / ${satellite.id}`,
    title: esc(satellite.name),
    summary: satellite.summary,
    meta: [
      { label: 'Plane', value: satellite.plane },
      { label: 'Status', value: satellite.status },
      { label: 'Launch', value: satellite.launch },
    ],
    badge: {
      label: satellite.telemetry ? 'On orbit' : satellite.status,
      tone: satellite.telemetry ? 'success' : 'warning',
    },
  })}
  <div class="shell detail-grid">
    <div class="detail-main">
      ${
        satellite.telemetry
          ? `<section class="satellite-telemetry" aria-label="Live-style telemetry"><div class="satellite-telemetry__head"><span class="mono-label">Node load</span>${statusBadge(
              satellite.status,
              satellite.status === 'Nominal' ? 'success' : 'warning',
            )}</div><div class="satellite-telemetry__value">${
              satellite.utilization
            }%</div><span class="util__track" aria-hidden="true"><span class="util__bar" style="width:${
              satellite.utilization
            }%"></span></span><div class="satellite-telemetry__grid"><div><span>Radiator</span><strong>${esc(
              satellite.radiator,
            )}</strong></div><div><span>Optical link</span><strong>${esc(
              satellite.link,
            )}</strong></div><div><span>Plane</span><strong>${esc(
              satellite.plane,
            )}</strong></div></div></section>`
          : ''
      }
      ${contentSections(sections, satellite)}
    </div>
    ${relatedLinks([
      { label: 'Constellation', to: '/network/constellation' },
      { label: 'Telemetry', to: '/network/telemetry' },
      { label: 'Ground stations', to: '/network/ground-stations' },
    ])}
  </div>
</article>`;
}

/**
 * Renders a ground-station detail page.
 * @param {string} slug
 * @returns {string}
 */
export function stationPage(slug) {
  const station = getStation(slug);
  if (!station) return notFoundPage();
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

  return `<article class="detail-page">
  ${pageIntro({
    eyebrow: `Network / Ground stations / ${station.code}`,
    title: esc(station.name),
    summary: station.summary,
    meta: [
      { label: 'Metro', value: station.metro },
      { label: 'p50', value: `${station.latency} ms` },
      { label: 'Since', value: station.since },
    ],
    badge: { label: station.status, tone: 'success' },
  })}
  <div class="shell detail-grid">
    <div class="detail-main">${contentSections(sections, station)}</div>
    ${relatedLinks([
      { label: 'All stations', to: '/network/ground-stations' },
      { label: 'Routes', to: '/network/routes' },
      { label: 'Constellation', to: '/network/constellation' },
    ])}
  </div>
</article>`;
}

/**
 * Renders the unlisted lab index.
 * @returns {string}
 */
