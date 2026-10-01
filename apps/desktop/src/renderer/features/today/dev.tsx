// /dev/screens/today — the Today screen fed by Main.dc.html's fixture (no IPC).
// Knobs: ?done=0|1|2|3 (blocks finished; default 1 = the design), ?midi=connected|no-device|…,
// ?add=1 (open the "Add something to learn" dialog).
import type { ComponentType } from 'react';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { mainFixture } from '../../dev/fixtures/main';
import { midiStatuses, user } from '../../dev/fixtures/user';
import type { MidiStatus } from '../../midi/MidiInput';
import { AddTrackDialog } from './AddTrackDialog';
import type { PlanBlockDto, TodayDto, TrackCardDto, TrackSummary } from './today';
import { TodayView } from './TodayView';

const LEVELS = ['c-major', 'a-major', 'g-major'] as const;
const SHORT = ['C major', 'A major', 'G major'] as const;
const MINUTES = [2, 5, 2] as const;
const TYPES = ['warmup', 'learn', 'review'] as const;

/** Main:57–101 with the first `done` blocks finished. done=1 reproduces the design exactly. */
export function fixtureToday(done: number): TodayDto {
  const blocks: PlanBlockDto[] = mainFixture.blocks.map((b, i) => {
    const status = i < done ? 'done' : i === done && done === 1 ? 'in_progress' : 'pending';
    const minutes = MINUTES[i] ?? 2;
    const meta = status === 'done' ? ' · done' : i === done ? ' · up next' : '';
    return {
      id: `fixture-${i}`,
      slot: i,
      type: TYPES[i] ?? 'warmup',
      kind: TYPES[i] ?? 'warmup',
      trackId: 'major-diatonic-chords',
      levelId: LEVELS[i] ?? 'c-major',
      eyebrow: b.eyebrow,
      title: b.title,
      shortTitle: SHORT[i] ?? 'C major',
      blurb: b.blurb,
      estimateMin: minutes,
      status,
      meta: `${minutes} min${meta}`,
      sessionId: null,
      lessonFirst: false,
      route: `/practice/${LEVELS[i] ?? 'c-major'}`,
      isEar: false,
    };
  });
  const next = blocks.find((b) => b.status !== 'done');
  const allDone = next === undefined;
  const { major, minor, rows } = mainFixture.tracks;
  const tracks: TrackCardDto[] = [
    card('major-diatonic-chords', major.title, 'in_progress', major.status, 3, major),
    card('minor-diatonic-chords', minor.title, 'ready', minor.status, 0, minor),
    ...rows.map((r): TrackCardDto => {
      const ear = r.available;
      return {
        trackId: ear ? 'ear-training' : r.title.toLowerCase().replace(/[^a-z]+/g, '-'),
        title: r.title,
        map: ear ? 'ladder' : 'circle-of-fifths',
        available: r.available,
        enrolled: ear,
        active: ear,
        status: ear ? 'in_progress' : 'not_started',
        statusLabel: ear ? 'In progress' : r.status,
        done: ear ? 2 : 0,
        total: ear ? 20 : 12,
        progressText: ear ? '2 of 20 levels' : '0 of 12 keys',
        nextText: null,
        currentLabel: ear ? r.status : null,
        currentLevelId: ear ? 'intervals-3' : null,
      };
    }),
  ];
  return {
    day: '2026-10-01',
    greeting: user.greeting,
    subtitle: mainFixture.subtitle,
    summary: mainFixture.planMeta,
    estimateMin: 9,
    blocks,
    cta: next
      ? {
          label:
            next.status === 'in_progress'
              ? `Continue with ${next.shortTitle}`
              : `Start ${next.shortTitle}`,
          route: next.route,
          subtitle: null,
          blockId: next.id,
          levelId: next.levelId,
          kind: next.kind,
          lessonFirst: false,
        }
      : {
          label: "That's today — explore the tracks",
          route: '/tracks',
          subtitle: 'Come back tomorrow to keep the streak.',
          blockId: null,
          levelId: null,
          kind: null,
          lessonFirst: false,
        },
    allDone,
    tracks,
  };
}

function card(
  trackId: string,
  title: string,
  status: TrackCardDto['status'],
  statusLabel: string,
  done: number,
  f: { left: string; right: string },
): TrackCardDto {
  return {
    trackId,
    title,
    map: 'circle-of-fifths',
    available: true,
    enrolled: status === 'in_progress',
    active: status === 'in_progress',
    status,
    statusLabel,
    done,
    total: 12,
    progressText: f.left,
    nextText: f.right,
    currentLabel: null,
    currentLevelId: null,
  };
}

const ADDABLE: TrackSummary[] = [
  {
    id: 'minor-diatonic-chords',
    title: 'Minor diatonic chords',
    map: 'circle-of-fifths',
    available: true,
  },
];

function isMidiKind(k: string | null): k is MidiStatus['kind'] {
  return k !== null && k in midiStatuses;
}

function TodayDevScreen() {
  const [params] = useSearchParams();
  const done = Math.min(3, Math.max(0, Number(params.get('done') ?? '1') || 0));
  const midiKind = params.get('midi');
  const midi = midiStatuses[isMidiKind(midiKind) ? midiKind : 'connected'];
  const [adding, setAdding] = useState(params.get('add') === '1');
  const close = useCallback(() => setAdding(false), []);
  return (
    <TodayView
      greeting={user.greeting}
      streakDays={user.streakDays}
      xp={user.xp}
      today={fixtureToday(done)}
      midi={midi}
      midiOverride={midi}
      onCta={() => undefined}
      onAddTrack={() => setAdding(true)}
    >
      {adding && <AddTrackDialog tracks={ADDABLE} onPick={close} onClose={close} />}
    </TodayView>
  );
}

export const devScreens: Record<string, ComponentType> = { today: TodayDevScreen };
