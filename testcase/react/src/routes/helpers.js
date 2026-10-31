/**
 * Creates a route record with consistent defaults for layout, breadcrumbs, static paths, and
 * metadata ownership. A head-only route lets the package Head component own metadata instead
 * of the site-wide usePageMeta hook.
 * @param {{ path: string, staticPaths?: string[], load: () => Promise<object>, meta: (params: Record<string, string>) => object, breadcrumbs?: (params: Record<string, string>) => Array<object>, layout?: string, hidden?: boolean, headOnly?: boolean, props?: object }} input
 * @returns {object}
 */
export function makeRoute({
  path,
  staticPaths,
  load,
  meta,
  breadcrumbs = () => [],
  layout = 'marketing',
  hidden = false,
  headOnly = false,
  props,
}) {
  return {
    path,
    staticPaths: staticPaths ?? [path],
    load,
    meta,
    breadcrumbs,
    layout,
    hidden,
    headOnly,
    props,
  };
}
