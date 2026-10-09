// Pure Today-screen logic (docs/ui.md §3 row `/`, docs/engine.md §4 PlanService). No IPC here so
// the renderer unit tests can import it without the contract runtime.
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contracts';
import type { MidiStatus } from '../../midi/MidiInput';

export type TodayDto = ChannelOutput<'plan.getToday'>;
export type PlanBlockDto = TodayDto['blocks'][number];
export type TrackCardDto = TodayDto['tracks'][number];

/** Task 07 Acceptance: morning < 12, afternoon < 18, evening otherwise (local hour). */
export function greetingFor(name: string, hour: number): string {
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const trimmed = name.trim();
  return trimmed ? `Good ${part}, ${trimmed}.` : `Good ${part}.`;
}

export type BlockState = 'done' | 'current' | 'upcoming';

/** Main:59 / 76 / 91 — done blocks show a check, the first open block is current, the rest upcoming. */
export function blockStates(blocks: readonly Pick<PlanBlockDto, 'status'>[]): BlockState[] {
  const firstOpen = blocks.findIndex((b) => b.status !== 'done');
  return blocks.map((b, i) =>
    b.status === 'done' ? 'done' : i === firstOpen ? 'current' : 'upcoming',
  );
}

export type CtaAction =
  { type: 'navigate'; to: string } | { type: 'start'; input: ChannelInput<'sessions.start'> };

/**
 * engine.md §4 PlanService step 8: the CTA starts the first block that is not done. A lesson that
 * is still due routes to `/tracks/:trackId/lesson` first; with nothing open it follows `cta.route`.
 */
export function ctaAction(today: Pick<TodayDto, 'cta' | 'blocks'>): CtaAction {
  const { cta } = today;
  const block = today.blocks.find((b) => b.id === cta.blockId);
  if (cta.blockId === null || cta.levelId === null || cta.kind === null || !block) {
    return { type: 'navigate', to: cta.route };
  }
  if (cta.lessonFirst || block.lessonFirst) {
    return { type: 'navigate', to: `/tracks/${block.trackId}/lesson` };
  }
  return {
    type: 'start',
    input: { levelId: cta.levelId, kind: cta.kind, planBlockId: cta.blockId },
  };
}

/** On the learner's daily plan: available, enrolled and not paused. */
export const isJoined = (t: Pick<TrackCardDto, 'available' | 'enrolled' | 'active'>): boolean =>
  t.available && t.enrolled && t.active;

/**
 * Main:119–160 "Your tracks" — only joined tracks (decisions.md 2026-10-08 "Track library": every
 * other track lives in the library at `/tracks`). Circle tracks get the full card (progress bar);
 * ladder tracks a compact row.
 */
export function partitionTracks(tracks: readonly TrackCardDto[]): {
  cards: TrackCardDto[];
  rows: TrackCardDto[];
} {
  const mine = tracks.filter(isJoined);
  const isCard = (t: TrackCardDto) => t.map === 'circle-of-fifths';
  return { cards: mine.filter(isCard), rows: mine.filter((t) => !isCard(t)) };
}

/** "Add something to learn" / "Pick something to learn" open the track library. */
export const LIBRARY_ROUTE = '/tracks';

/** Main:109 beside the CTA; ui.md §3 all-done variant shows the kept streak instead. */
export function ctaNote(opts: { allDone: boolean; streakDays: number; midi: MidiStatus }): string {
  if (opts.allDone) return `Day ${opts.streakDays} streak kept`;
  return opts.midi.kind === 'connected'
    ? 'Your keyboard is listening — just play.'
    : 'No keyboard? You can mark each chord as played.';
}

/**
 * Task 16 edge states. `no-tracks`: nothing enrolled and active and no plan today (a plan built
 * before the learner paused everything still shows). `all-complete`: every active track is
 * finished (all keys on a circle, every ear level).
 */
export type TodayMode = 'plan' | 'no-tracks' | 'all-complete';

export function todayMode(today: Pick<TodayDto, 'tracks' | 'blocks'>): TodayMode {
  const active = today.tracks.filter(isJoined);
  if (active.length === 0) return today.blocks.length === 0 ? 'no-tracks' : 'plan';
  if (active.every((t) => t.status === 'complete')) return 'all-complete';
  return 'plan';
}

export const NO_TRACKS_SUBTITLE =
  'You’re not learning anything right now. Pick a track and Cadence plans each day for you.';
export const NO_TRACKS_CTA = 'Pick something to learn';
export const ALL_COMPLETE_SUBTITLE =
  'Everything you’re learning is complete. Keep it fresh with a review, or add something new.';

/** The subtitle under the greeting, by mode (the engine's copy when there is a plan). */
export function todaySubtitle(today: TodayDto): string {
  const mode = todayMode(today);
  if (mode === 'no-tracks') return NO_TRACKS_SUBTITLE;
  if (today.allDone) return today.cta.subtitle ?? today.subtitle;
  if (mode === 'all-complete' && today.blocks.length === 0) return ALL_COMPLETE_SUBTITLE;
  return today.subtitle;
}

export type ResumeDto = NonNullable<TodayDto['resume']>;

/**
 * Task 16: "Resume A major" for a session left mid-level today. Hidden when the CTA already
 * continues that level (its plan block is in progress and `sessions.start` resumes it).
 */
export function resumeOffer(today: Pick<TodayDto, 'resume' | 'cta'>): ResumeDto | null {
  const r = today.resume;
  if (r === null) return null;
  if (today.cta.levelId === r.levelId) return null;
  return r;
}

/** "3 of 7 chords played" · "1 of 2 scales played" · "4 of 10 answered". */
export function resumeProgress(
  r: Pick<ResumeDto, 'done' | 'total' | 'isEar' | 'stepNoun'>,
): string {
  return r.isEar
    ? `${r.done} of ${r.total} answered`
    : `${r.done} of ${r.total} ${r.stepNoun}s played`;
}
