// `/practice/:levelId` (docs/ui.md §3) — query `session` (resume) and `block` (plan block).
import { useNavigate, useParams } from 'react-router';
import { useMidiStatus } from '../../midi/hooks';
import { useInvalidateProgress, useMe } from '../shared/hooks';
import styles from './PracticePage.module.css';
import type { PracticeSession } from './practiceReducer';
import { eyebrowFor, markPlayedMode } from './practiceSelectors';
import { PracticeView } from './PracticeView';
import {
  useLivePracticeIo,
  usePracticeLoader,
  usePracticeSession,
  type CompleteRouteState,
} from './usePracticeSession';

export function PracticePage() {
  const { levelId } = useParams();
  const { session, error } = usePracticeLoader(levelId);
  if (session === null) {
    return (
      <div className={styles.page} data-testid="practice-loading">
        <div className={styles.status} role={error !== null ? 'alert' : 'status'}>
          {error !== null ? `Couldn’t open this practice. ${error}` : 'Getting your keys ready…'}
        </div>
      </div>
    );
  }
  return <LivePractice key={session.sessionId} session={session} />;
}

function LivePractice({ session }: { session: PracticeSession }) {
  const io = useLivePracticeIo();
  const navigate = useNavigate();
  const invalidate = useInvalidateProgress();
  const status = useMidiStatus();
  const me = useMe();
  const practice = usePracticeSession(session, io, {
    onFinished: (complete) => {
      void invalidate();
      const state: CompleteRouteState = { complete };
      void navigate(`/complete/${encodeURIComponent(complete.sessionId)}`, { state });
    },
  });
  return (
    <PracticeView
      state={practice.state}
      title={session.levelTitle}
      eyebrow={eyebrowFor(session)}
      midiStatus={status}
      markPlayed={markPlayedMode(status, me.data?.settings.showMarkPlayedAlways ?? false)}
      onHint={practice.hint}
      onSkip={practice.skip}
      onMarkPlayed={practice.markPlayed}
      onVisibility={practice.setVisibility}
      onFinish={practice.finish}
      finishing={practice.finishing}
      finishError={practice.finishError}
    />
  );
}
