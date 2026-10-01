// Pure Today-screen logic (docs/ui.md §3 row `/`, docs/engine.md §4 PlanService). No IPC here so
// the renderer unit tests can import it without the contract runtime.
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contracts';
import type { MidiStatus } from '../../midi/MidiInput';

export type TodayDto = ChannelOutput<'plan.getToday'>;
export type PlanBlockDto = TodayDto['blocks'][number];
export type TrackCardDto = TodayDto['tracks'][number];
export type TrackSummary = ChannelOutput<'content.tracks'>[number];

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

/**
 * Main:119–160 — available circle tracks get the full card (progress bar); everything else
 * (ladder tracks, tracks not yet available) is a compact row.
 */
export function partitionTracks(tracks: readonly TrackCardDto[]): {
  cards: TrackCardDto[];
  rows: TrackCardDto[];
} {
  const isCard = (t: TrackCardDto) => t.available && t.map === 'circle-of-fifths';
  return { cards: tracks.filter(isCard), rows: tracks.filter((t) => !isCard(t)) };
}

/** Tracks "Add something to learn" can enroll: available and not active yet. */
export function addableTracks(
  summaries: readonly TrackSummary[],
  cards: readonly Pick<TrackCardDto, 'trackId' | 'active'>[],
): TrackSummary[] {
  const active = new Set(cards.filter((c) => c.active).map((c) => c.trackId));
  return summaries.filter((t) => t.available && !active.has(t.id));
}

/** Main:109 beside the CTA; ui.md §3 all-done variant shows the kept streak instead. */
export function ctaNote(opts: { allDone: boolean; streakDays: number; midi: MidiStatus }): string {
  if (opts.allDone) return `Day ${opts.streakDays} streak kept`;
  return opts.midi.kind === 'connected'
    ? 'Your keyboard is listening — just play.'
    : 'No keyboard? You can mark each chord as played.';
}
