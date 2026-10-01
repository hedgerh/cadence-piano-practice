// Complete.dc.html view model: everything the screen shows, derived from the engine's CompleteDto
// (docs/engine.md §4 ProgressService.finishSession) plus the skipped variant (docs/ui.md §3).
import type { RomanChipState } from '../../components/ui/RomanChip';
import type { CompleteDto } from '../shared/hooks';

export type { CompleteDto };

/** engine.md §6.7 — the timer is shown `m:ss` (Complete:50 "2:14"). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
] as const;
const word = (n: number): string => WORDS[n] ?? String(n);
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export interface CompleteChipView {
  key: string;
  numeral: string;
  sub: string;
  state: RomanChipState;
}

/**
 * Complete:39–45. Clean → teal; hinted → tangerine tint "G♯° · hint" (as designed);
 * skipped → dashed (ui.md §3) "Bm · skipped"; marked → teal "D · marked"; wrong (ear) → dashed.
 */
export function chipView(chip: CompleteDto['chips'][number]): CompleteChipView {
  const base = { key: `${chip.ordinal}-${chip.stepId}`, numeral: chip.label };
  switch (chip.result) {
    case 'clean':
      return { ...base, sub: chip.short, state: 'done' };
    case 'hinted':
      return { ...base, sub: `${chip.short} · hint`, state: 'hinted' };
    case 'marked':
      return { ...base, sub: `${chip.short} · marked`, state: 'done' };
    case 'skipped':
      return { ...base, sub: `${chip.short} · skipped`, state: 'skipped' };
    case 'wrong':
      return { ...base, sub: chip.short, state: 'skipped' };
  }
}

export type CompleteAction =
  | { kind: 'replay'; label: string }
  | { kind: 'next'; label: string; levelId: string }
  | { kind: 'done'; label: string };

export interface CompleteView {
  title: string;
  subtitle: string;
  chips: CompleteChipView[];
  stats: ReadonlyArray<{ value: string; label: string; tone: 'ground' | 'lavender' }>;
  progressLeft: string;
  progressRight: string | null;
  progress: number;
  reviewNote: string;
  /** Rendered as PrimaryButton / SecondaryButton / TextButton, in that order. */
  primary: CompleteAction;
  secondary: CompleteAction | null;
  tertiary: CompleteAction | null;
  skipped: number;
}

const DONE: CompleteAction = { kind: 'done', label: 'Done for today' };

/** Complete:35 — the engine's subtitle, with the first sentence adjusted when chords were skipped. */
function subtitleFor(dto: CompleteDto, skipped: number): string {
  if (skipped === 0) return dto.subtitle;
  const cut = dto.subtitle.indexOf('. ');
  const rest = cut >= 0 ? dto.subtitle.slice(cut + 1) : '';
  const played = dto.total - skipped;
  return `${capital(word(played))} of ${word(dto.total)} played, ${word(skipped)} skipped for now.${rest}`;
}

/** Complete:59 — "day 8 streak kept". */
function streakLabel(streak: CompleteDto['streak']): string {
  return streak.keptToday ? `day ${streak.days} streak kept` : `day ${streak.days} streak`;
}

/** Complete:66 — "Next on the circle: E major" (circle) / "Next: Level 4" (ladder). */
function nextLabel(dto: CompleteDto): string | null {
  if (dto.track.nextTitle === null) return null;
  return dto.track.unit === 'keys'
    ? `Next on the circle: ${dto.track.nextTitle}`
    : `Next: ${dto.track.nextTitle}`;
}

export function completeView(dto: CompleteDto): CompleteView {
  const skipped = dto.skippedCount;
  const next: CompleteAction | null = dto.next
    ? { kind: 'next', label: dto.next.label, levelId: dto.next.levelId }
    : null;

  // ui.md §3: with skips the primary replays the level ("Play the two you skipped") and
  // "Keep going" is demoted to the secondary button; "Done for today" becomes a text button.
  let primary: CompleteAction;
  let secondary: CompleteAction | null;
  let tertiary: CompleteAction | null = null;
  if (skipped > 0) {
    primary = { kind: 'replay', label: `Play the ${word(skipped)} you skipped` };
    secondary = next ?? DONE;
    tertiary = next ? DONE : null;
  } else if (next) {
    primary = next;
    secondary = DONE;
  } else {
    primary = DONE;
    secondary = null;
  }

  return {
    title: dto.title,
    subtitle: subtitleFor(dto, skipped),
    chips: dto.chips.map(chipView),
    stats: [
      { value: formatDuration(dto.durationMs), label: 'time, no tempo', tone: 'ground' },
      {
        value: `${dto.cleanCount} of ${dto.total}`,
        label: dto.isEar ? 'without a hint' : 'chords without a hint',
        tone: 'ground',
      },
      // engine.md §4 XpService: the tile shows the level bonus only (+40), as designed.
      { value: `+${dto.xp.level} XP`, label: streakLabel(dto.streak), tone: 'lavender' },
    ],
    progressLeft: `${dto.track.title} · ${dto.track.done} of ${dto.track.total} ${dto.track.unit}`,
    progressRight: nextLabel(dto),
    progress: dto.track.total > 0 ? dto.track.done / dto.track.total : 0,
    reviewNote: dto.reviewNote,
    primary,
    secondary,
    tertiary,
    skipped,
  };
}
