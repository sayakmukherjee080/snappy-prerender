import { getNetworkCorePage, NETWORK_CORE_PAGES } from '../content/catalog/networkCore.js';
import { getSatellite, SATELLITES } from '../content/catalog/satellites.js';
import { getStation, STATIONS } from '../content/catalog/stations.js';
import { makeRoute } from './helpers.js';

export const networkRoutes = [
  makeRoute({
    path: '/network/:slug',
    staticPaths: NETWORK_CORE_PAGES.map((page) => `/network/${page.slug}`),
    load: () => import('../pages/network/NetworkCorePage.jsx'),
    meta: (params) => {
      const page = getNetworkCorePage(params.slug);
      return {
        title: page?.title ?? 'Network',
        description: page?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const page = getNetworkCorePage(params.slug);
      return [{ label: 'Network', to: '/network' }, { label: page?.title ?? params.slug }];
    },
  }),
  makeRoute({
    path: '/network/satellites/:slug',
    staticPaths: SATELLITES.map((satellite) => `/network/satellites/${satellite.slug}`),
    load: () => import('../pages/network/SatellitePage.jsx'),
    meta: (params) => {
      const satellite = getSatellite(params.slug);
      return {
        title: satellite?.name ?? 'Satellite',
        description: satellite?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const satellite = getSatellite(params.slug);
      return [
        { label: 'Network', to: '/network' },
        { label: 'Satellites', to: '/network/constellation' },
        { label: satellite?.id ?? params.slug },
      ];
    },
  }),
  makeRoute({
    path: '/network/ground-stations/:slug',
    staticPaths: STATIONS.map((station) => `/network/ground-stations/${station.slug}`),
    load: () => import('../pages/network/StationPage.jsx'),
    meta: (params) => {
      const station = getStation(params.slug);
      return {
        title: station?.name ?? 'Ground station',
        description: station?.summary ?? '',
      };
    },
    breadcrumbs: (params) => {
      const station = getStation(params.slug);
      return [
        { label: 'Network', to: '/network' },
        { label: 'Ground stations', to: '/network/ground-stations' },
        { label: station?.name ?? params.slug },
      ];
    },
  }),
];
