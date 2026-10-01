// `/complete/:sessionId` (docs/ui.md §3, Complete.dc.html).
//
// Data source: Practice's "Finish the key" navigates here with router state
// `{ complete: CompleteDto }` (CompleteRouteState), which is what we render. Without it (opened
// directly or from history) we load the session with `sessions.get`: only when it is already
// finished do we ask `sessions.finish` for its summary, which for a finished session rebuilds
// the DTO without writing anything (core progress.service finishSession's early return). An
// unfinished session is never finished from here; we link back to its Practice instead.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { ChannelOutput } from '@shared/ipc/contracts';
import { api, queryKey } from '../../lib/api';
import type { CompleteRouteState } from '../practice/usePracticeSession';
import { sessionRoute, useStartSession, type CompleteDto } from '../shared/hooks';
import type { CompleteAction } from './complete';
import styles from './CompletePage.module.css';
import { CompleteView } from './CompleteView';

function isCompleteState(state: unknown, sessionId: string): state is CompleteRouteState {
  if (typeof state !== 'object' || state === null || !('complete' in state)) return false;
  const complete = state.complete;
  return (
    typeof complete === 'object' &&
    complete !== null &&
    (complete as { sessionId?: unknown }).sessionId === sessionId
  );
}

type Loaded = { kind: 'complete'; complete: CompleteDto } | { kind: 'unfinished'; route: string };

async function loadComplete(sessionId: string): Promise<Loaded> {
  const session = await api['sessions.get']({ sessionId });
  if (session.finishedAt === null) return { kind: 'unfinished', route: sessionRoute(session) };
  // Read-only for a finished session (see the header comment).
  const complete = await api['sessions.finish']({ sessionId, durationMs: 0 });
  return { kind: 'complete', complete };
}

export function CompletePage() {
  const { sessionId = '' } = useParams();
  const { state } = useLocation() as { state: unknown };
  const fromRoute = isCompleteState(state, sessionId) ? state.complete : null;
  const fallback = useQuery({
    queryKey: ['complete.fallback', sessionId],
    queryFn: () => loadComplete(sessionId),
    enabled: fromRoute === null && sessionId !== '',
    staleTime: Infinity,
    retry: false,
  });

  if (fromRoute !== null) return <LiveComplete complete={fromRoute} />;
  if (fallback.data?.kind === 'complete') return <LiveComplete complete={fallback.data.complete} />;
  return (
    <div className={styles.page} data-testid="complete-loading">
      <div className={styles.status} role={fallback.isError ? 'alert' : 'status'}>
        {fallback.isError ? (
          <>
            <span>Couldn’t find this practice.</span>
            <Link to="/">Back to Today</Link>
          </>
        ) : fallback.data?.kind === 'unfinished' ? (
          <>
            <span>This practice isn’t finished yet.</span>
            <Link to={fallback.data.route}>Back to the keys</Link>
          </>
        ) : (
          'Adding it up…'
        )}
      </div>
    </div>
  );
}

function LiveComplete({ complete }: { complete: CompleteDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const start = useStartSession();
  const [error, setError] = useState<string | null>(null);

  /** engine.md §6.8: reuse today's open plan block for the level when there is one. */
  const startLevel = async (levelId: string, fallbackKind: 'learn' | 'review') => {
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

  const onAction = (action: CompleteAction) => {
    setError(null);
    if (action.kind === 'done') {
      void navigate('/');
      return;
    }
    // "Play the two you skipped" replays this level (the engine has no per-step sessions).
    const run =
      action.kind === 'next'
        ? startLevel(action.levelId, 'learn')
        : startLevel(complete.levelId, 'review');
    run.catch(() => setError('Couldn’t start that practice. Try again.'));
  };

  return (
    <CompleteView complete={complete} onAction={onAction} busy={start.isPending} error={error} />
  );
}
