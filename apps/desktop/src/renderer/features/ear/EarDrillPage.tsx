// `/ear/:levelId` (docs/ui.md §3) — query `session` (resume) and `block` (plan block).
// Loads or starts the session, then picks the drill by the level's step match/play types:
// `root` → KeyDrill (Task 15), `choice` → ChoiceDrill (intervals, degrees, quality, chords).
import type { Level, Stage, Track } from '@cadence/content';
import { useNavigate, useParams } from 'react-router';
import { usePracticeLoader } from '../practice/usePracticeSession';
import { useInvalidateProgress, useTrack } from '../shared/hooks';
import { ChoiceDrill } from './ChoiceDrill';
import styles from './ChoiceDrill.module.css';
import { stageKindOf } from './choiceModel';
import type { EarSession } from './earDrillReducer';
import { KeyDrill } from './KeyDrill';
import { useEarDrill, useLiveEarIo, type EarResultsRouteState } from './useEarDrill';

/** The level and its stage inside a ladder track (circle tracks have no stages). */
export function findLevel(
  track: Track,
  levelId: string,
): { level: Level; stage: Stage | null } | null {
  for (const stage of track.stages ?? []) {
    const level = stage.levels.find((l) => l.id === levelId);
    if (level) return { level, stage };
  }
  const level = track.levels?.find((l) => l.id === levelId);
  return level ? { level, stage: null } : null;
}

export type EarDrillKind = 'choice' | 'key' | 'none';

/** ui.md §3: the drill component follows the level's step match type. */
export function drillKindOf(session: Pick<EarSession, 'questions'>): EarDrillKind {
  const first = session.questions[0];
  if (first === undefined) return 'none';
  if (first.match.type === 'root') return 'key';
  if (first.match.type === 'choice') return 'choice';
  return 'none';
}

export function EarDrillPage() {
  const { levelId } = useParams();
  const { session, error } = usePracticeLoader(levelId);
  const track = useTrack(session?.trackId);
  const backTo = `/tracks/${session?.trackId ?? 'ear-training'}`;

  const found = session && track.data ? findLevel(track.data, session.levelId) : null;
  const kind = session ? drillKindOf(session) : 'none';
  const failure =
    error ??
    (track.isError ? 'The track didn’t load.' : null) ??
    (session && track.data && (found === null || kind === 'none')
      ? 'This level has no ear questions.'
      : null);

  if (session === null || found === null || failure !== null) {
    return (
      <div className={styles.page} data-testid="ear-loading">
        <main className={styles.main}>
          <div className={styles.done} role={failure !== null ? 'alert' : 'status'}>
            {failure !== null ? `Couldn’t open this drill. ${failure}` : 'Tuning up…'}
          </div>
        </main>
      </div>
    );
  }
  if (kind === 'key') return <KeyDrill session={session} backTo={backTo} />;
  return (
    <LiveChoiceDrill
      key={session.sessionId}
      session={session}
      level={found.level}
      stage={found.stage}
      backTo={backTo}
    />
  );
}

function LiveChoiceDrill({
  session,
  level,
  stage,
  backTo,
}: {
  session: EarSession;
  level: Level;
  stage: Stage | null;
  backTo: string;
}) {
  const io = useLiveEarIo();
  const navigate = useNavigate();
  const invalidate = useInvalidateProgress();
  const drill = useEarDrill(session, io, {
    onFinished: (complete) => {
      void invalidate();
      const state: EarResultsRouteState = { complete };
      void navigate(`/ear/results/${encodeURIComponent(complete.sessionId)}`, { state });
    },
  });
  return (
    <ChoiceDrill
      drill={drill}
      kind={stageKindOf(stage?.id)}
      title={session.shortTitle}
      activeOptions={level.activeOptions ?? null}
      backTo={backTo}
    />
  );
}
