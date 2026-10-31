import { getAllRoutePaths } from '../router/match.js';
import { apiRoutes } from './api.routes.js';
import { blogRoutes } from './blog.routes.js';
import { companyRoutes } from './company.routes.js';
import { customersRoutes } from './customers.routes.js';
import { docsRoutes } from './docs.routes.js';
import { labRoutes } from './labs.routes.js';
import { legalRoutes } from './legal.routes.js';
import { mainRoutes } from './main.routes.js';
import { modelsRoutes } from './models.routes.js';
import { networkRoutes } from './network.routes.js';
import { platformRoutes } from './platform.routes.js';
import { pricingRoutes } from './pricing.routes.js';
import { regionsRoutes } from './regions.routes.js';
import { resourcesRoutes } from './resources.routes.js';
import { solutionsRoutes } from './solutions.routes.js';

export const routes = [
  ...mainRoutes,
  ...platformRoutes,
  ...networkRoutes,
  ...pricingRoutes,
  ...companyRoutes,
  ...docsRoutes,
  ...modelsRoutes,
  ...solutionsRoutes,
  ...customersRoutes,
  ...regionsRoutes,
  ...resourcesRoutes,
  ...blogRoutes,
  ...apiRoutes,
  ...legalRoutes,
  ...labRoutes,
];

export const routeCount = getAllRoutePaths(routes).length;
