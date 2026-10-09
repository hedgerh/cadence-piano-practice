import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useMidiStatus } from '../../midi/hooks';
import {
  KEYS,
  sessionRoute,
  useMe,
  useStartSession,
  useToday,
  useUpdateMe,
  type MeDto,
} from '../shared/hooks';
import { Onboarding } from './Onboarding';
import { ctaAction, greetingFor } from './today';
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
  const start = useStartSession();
  const greeting = useMemo(() => greetingFor(me.name, new Date().getHours()), [me.name]);

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

  return (
    <TodayView
      greeting={greeting}
      streakDays={me.streak.days}
      xp={me.xpTotal}
      today={today.data}
      midi={midi}
      onCta={onCta}
      ctaBusy={start.isPending}
    />
  );
}
