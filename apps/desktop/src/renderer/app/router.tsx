import { createHashRouter } from 'react-router';
import { Shell } from './Shell';

/**
 * HashRouter: production loads from file://, where BrowserRouter breaks on reload.
 * Routes per docs/ui.md §7.3. Screens are added task by task (07–15).
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
  },
]);
