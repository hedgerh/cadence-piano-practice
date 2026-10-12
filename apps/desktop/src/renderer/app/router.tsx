import { createHashRouter, Navigate, type RouteObject } from 'react-router';
import { devRoutes } from '../dev/routes';
import { TodayPage } from '../features/today/TodayPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { TracksRoute } from '../features/path/TracksRoute';
import { LearnPage } from '../features/learn/LearnPage';
import { PracticePage } from '../features/practice/PracticePage';
import { CompletePage } from '../features/complete/CompletePage';
import { EarDrillPage } from '../features/ear/EarDrillPage';
import { IntervalPracticePage } from '../features/ear/IntervalPracticePage';
import { EarResultsPage } from '../features/ear/EarResultsPage';

export interface RouterOptions {
  /** Register /dev/components and /dev/screens/:name (dev and e2e only). */
  devRoutes: boolean;
}

/**
 * HashRouter: production loads from file://, where BrowserRouter breaks on reload.
 * Routes per docs/ui.md §3. Each feature owns its page component; this table is fixed.
 */
export function createAppRouter(opts: RouterOptions) {
  const routes: RouteObject[] = [
    { path: '/', element: <TodayPage /> },
    { path: '/tracks', element: <LibraryPage /> },
    { path: '/tracks/:trackId', element: <TracksRoute /> },
    { path: '/tracks/:trackId/lesson', element: <LearnPage /> },
    { path: '/practice/:levelId', element: <PracticePage /> },
    { path: '/complete/:sessionId', element: <CompletePage /> },
    { path: '/ear/results/:sessionId', element: <EarResultsPage /> },
    { path: '/ear/:levelId', element: <EarDrillPage /> },
    // decisions.md 2026-10-11 "Interval practice": free drill, nothing recorded.
    { path: '/ear-practice/intervals', element: <IntervalPracticePage /> },
    { path: '*', element: <Navigate to="/" replace /> },
  ];
  if (opts.devRoutes) routes.push(...devRoutes);
  return createHashRouter(routes);
}
