// `/ear/results/:sessionId` (docs/ui.md §3 EarResults).
//
// Data source: the drill navigates here with router state `{ complete: CompleteDto }`
// (EarResultsRouteState). Without it (opened directly or from history) we load the session:
// only a finished one is summarised, via `sessions.finish`, which for a finished session rebuilds
// the DTO without writing anything (core progress.service finishSession's early return).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { ChannelOutput } from '@shared/ipc/contracts';
import { api, queryKey } from '../../lib/api';
import { sessionRoute, useStartSession, type SessionDto } from '../shared/hooks';
import type { EarResultsAction } from './earResults';
import styles from './EarResultsPage.module.css';
import { EarResultsView } from './EarResultsView';
import type { CompleteDto, EarResultsRouteState } from './useEarDrill';

function isResultsState(state: unknown, sessionId: string): state is EarResultsRouteState {
  if (typeof state !== 'object' || state === null || !('complete' in state)) return false;
  const complete = state.complete;
  return (
    typeof complete === 'object' &&
    complete !== null &&
    (complete as { sessionId?: unknown }).sessionId === sessionId
  );
}

type Loaded = { kind: 'complete'; complete: CompleteDto } | { kind: 'unfinished'; route: string };

async function loadResults(sessionId: string): Promise<Loaded> {
  const session = await api['sessions.get']({ sessionId });
  if (session.finishedAt === null) return { kind: 'unfinished', route: sessionRoute(session) };
  // Read-only for a finished session (see the header comment).
  const complete = await api['sessions.finish']({ sessionId, durationMs: 0 });
  return { kind: 'complete', complete };
}

export function EarResultsPage() {
  const { sessionId = '' } = useParams();
  const { state } = useLocation() as { state: unknown };
  const fromRoute = isResultsState(state, sessionId) ? state.complete : null;
  const fallback = useQuery({
    queryKey: ['ear-results.fallback', sessionId],
    queryFn: () => loadResults(sessionId),
    enabled: fromRoute === null && sessionId !== '',
    staleTime: Infinity,
    retry: false,
  });

  if (fromRoute !== null) return <LiveResults complete={fromRoute} />;
  if (fallback.data?.kind === 'complete') return <LiveResults complete={fallback.data.complete} />;
  return (
    <div className={styles.page} data-testid="ear-results-loading">
      <div className={styles.status} role={fallback.isError ? 'alert' : 'status'}>
        {fallback.isError ? (
          <>
            <span>Couldn’t find these results.</span>
            <Link to="/">Back to Today</Link>
          </>
        ) : fallback.data?.kind === 'unfinished' ? (
          <>
            <span>This drill isn’t finished yet.</span>
            <Link to={fallback.data.route}>Back to the drill</Link>
          </>
        ) : (
          'Adding it up…'
        )}
      </div>
    </div>
  );
}

function LiveResults({ complete }: { complete: CompleteDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const start = useStartSession();
  const [error, setError] = useState<string | null>(null);

  /** engine.md §4 focus rounds: no plan block, kind free. */
  const startFocus = async (levelId: string) => {
    const session = await start.mutateAsync({ levelId, kind: 'free', focus: 'misses' });
    await navigate(sessionRoute(session));
  };

  /** engine.md §6.8: reuse today's open plan block for the level when there is one. */
  const startLevel = async (levelId: string, fallbackKind: SessionDto['kind']) => {
    let block: ChannelOutput<'plan.getToday'>['blocks'][number] | undefined;
    try {
      const today = await qc.fetchQuery({
        queryKey: queryKey('plan.getToday'),
        queryFn: () => api['plan.getToday'](),
      });
      block = today.blocks.find((b) => b.levelId === levelId && b.status !== 'done');
    } catch {
      block = undefined;
    }
    const session = await start.mutateAsync({
      levelId,
      kind: block?.kind ?? fallbackKind,
      ...(block ? { planBlockId: block.id } : {}),
    });
    await navigate(sessionRoute(session));
  };

  const onAction = (action: EarResultsAction) => {
    setError(null);
    if (action.kind === 'done') {
      void navigate('/');
      return;
    }
    // "Try Level 3 again" starts a new session on the same level (the old one is finished).
    // "Back to Level 3" (from a focus round) starts a normal session on the level.
    const run =
      action.kind === 'drill'
        ? startFocus(action.levelId)
        : action.kind === 'next' || action.kind === 'back'
          ? startLevel(action.levelId, 'learn')
          : startLevel(action.levelId, complete.kind);
    run.catch(() => setError('Couldn’t start that drill. Try again.'));
  };

  return (
    <EarResultsView complete={complete} onAction={onAction} busy={start.isPending} error={error} />
  );
}
