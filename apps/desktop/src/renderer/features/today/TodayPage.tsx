import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMidiStatus } from '../../midi/hooks';
import {
  KEYS,
  sessionRoute,
  useMe,
  useSetTrackSettings,
  useStartSession,
  useToday,
  useTracks,
  useUpdateMe,
  type MeDto,
} from '../shared/hooks';
import { AddTrackDialog } from './AddTrackDialog';
import { Onboarding } from './Onboarding';
import { addableTracks, ctaAction, greetingFor } from './today';
import { TodayView } from './TodayView';
import styles from './TodayPage.module.css';

/** Route `/` (ui.md §3): onboarding on first run, otherwise Today. */
export function TodayPage() {
  const me = useMe();
  if (me.isPending) return <div className={styles.page} data-testid="today-loading" />;
  if (me.isError) throw me.error;
  if (me.data.firstRun) return <FirstRun />;
  return <Today me={me.data} />;
}

function FirstRun() {
  const qc = useQueryClient();
  const update = useUpdateMe();
  return (
    <Onboarding
      busy={update.isPending}
      onSubmit={(name) =>
        update.mutate(
          { name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          {
            onSuccess: () =>
              void Promise.all([
                qc.invalidateQueries({ queryKey: KEYS.today }),
                qc.invalidateQueries({ queryKey: KEYS.tracks }),
              ]),
          },
        )
      }
    />
  );
}

function Today({ me }: { me: MeDto }) {
  const navigate = useNavigate();
  const midi = useMidiStatus();
  const today = useToday();
  const tracks = useTracks();
  const start = useStartSession();
  const enroll = useSetTrackSettings();
  const [adding, setAdding] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const greeting = useMemo(() => greetingFor(me.name, new Date().getHours()), [me.name]);
  const closeDialog = useCallback(() => setAdding(false), []);

  if (today.isError) throw today.error;

  const onCta = () => {
    if (!today.data || start.isPending) return;
    const action = ctaAction(today.data);
    if (action.type === 'navigate') {
      void navigate(action.to);
      return;
    }
    start.mutate(action.input, { onSuccess: (session) => void navigate(sessionRoute(session)) });
  };

  const onPick = (trackId: string) => {
    setEnrollingId(trackId);
    enroll.mutate(
      { trackId, active: true },
      {
        onSettled: () => setEnrollingId(null),
        onSuccess: () => setAdding(false),
      },
    );
  };

  return (
    <TodayView
      greeting={greeting}
      streakDays={me.streak.days}
      xp={me.xpTotal}
      today={today.data}
      midi={midi}
      onCta={onCta}
      ctaBusy={start.isPending}
      onAddTrack={() => setAdding(true)}
    >
      {adding && (
        <AddTrackDialog
          tracks={addableTracks(tracks.data ?? [], today.data?.tracks ?? [])}
          busyId={enrollingId}
          onPick={onPick}
          onClose={closeDialog}
        />
      )}
    </TodayView>
  );
}
