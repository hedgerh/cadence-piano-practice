import type { RouteObject } from 'react-router';
import { DevComponents } from './DevComponents';
import { DevScreens } from './DevScreens';

/** Registered only when RuntimeMode.devTools (dev server or CADENCE_E2E). */
export const devRoutes: RouteObject[] = [
  { path: '/dev/components', element: <DevComponents /> },
  { path: '/dev/screens/:name', element: <DevScreens /> },
];
