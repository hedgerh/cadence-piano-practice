import { createHashRouter, type RouteObject } from 'react-router';
import { devRoutes } from '../dev/routes';
import { Shell } from './Shell';

export interface RouterOptions {
  /** Register /dev/components and /dev/screens/:name (dev and e2e only). */
  devRoutes: boolean;
}

/**
 * HashRouter: production loads from file://, where BrowserRouter breaks on reload.
 * Routes per docs/ui.md §3. Screens are added task by task (07–15).
 */
export function createAppRouter(opts: RouterOptions) {
  const routes: RouteObject[] = [
    {
      path: '/',
      element: <Shell />,
    },
  ];
  if (opts.devRoutes) routes.push(...devRoutes);
  return createHashRouter(routes);
}
