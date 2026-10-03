// /dev/screens/complete — Complete.dc.html's fixture (A major, vii° hinted) as a CompleteDto.
// Knob: ?skipped=1,4 (0-based ordinals resolved as skipped: dashed chips, adjusted copy,
// "Play the two you skipped" primary and "Keep going" demoted; docs/ui.md §3).
// Knob: ?auto=1|0 (default 1, the profile default): the hands-free countdown, frozen at "in 3…"
// for deterministic screenshots; add &run=1 to let it count down (decisions.md 2026-10-01).
import { useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import { completeFixture } from '../../dev/fixtures/complete';
import type { CompleteDto } from './complete';
import { CompleteView } from './CompleteView';
import { frozenSchedule, realSchedule } from './useHandsFreeNext';

const STEP_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] as const;
const QUALITIES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'] as const;

function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** engine.md §4 XpService: 5 per resolved (non-skipped) step + the 40 level bonus; 1,240 before. */
function xpFor(earning: number): CompleteDto['xp'] {
  const steps = 5 * earning;
  return { level: 40, steps, playback: 0, total: 40 + steps, newTotal: 1240 + 40 + steps };
}

/** Complete:34–71 as the engine would return it; `skipped` ordinals resolve as skipped. */
export function completeDtoFixture(skipped: readonly number[] = []): CompleteDto {
  const chips: CompleteDto['chips'] = completeFixture.chips.map((c, i) => ({
    ordinal: i,
    stepId: STEP_IDS[i] ?? `d${i + 1}`,
    label: c.numeral,
    short: c.sub.replace(' · hint', ''),
    quality: QUALITIES[i] ?? null,
    result: skipped.includes(i) ? 'skipped' : c.state === 'hinted' ? 'hinted' : 'clean',
  }));
  const count = (r: CompleteDto['chips'][number]['result']) =>
    chips.filter((c) => c.result === r).length;
  const missed = chips.filter((c) => c.result !== 'clean').map((c) => c.short);
  const reviewNote =
    missed.length === 1
      ? `${missed[0] ?? ''} will come back in tomorrow's review until it's clean.`
      : `${joinAnd(missed)} come back tomorrow.`;
  return {
    sessionId: 'dev-complete',
    focus: null,
    run: null,
    runPosition: null,
    kind: 'learn',
    trackId: 'major-diatonic-chords',
    levelId: 'a-major',
    levelTitle: 'A major',
    shortTitle: 'A major',
    isEar: false,
    title: completeFixture.title,
    subtitle: completeFixture.body,
    completed: true,
    passed: true,
    firstCompletion: true,
    durationMs: 134_000, // Complete:50 "2:14"
    total: 7,
    cleanCount: count('clean'),
    hintedCount: count('hinted'),
    skippedCount: count('skipped'),
    markedCount: 0,
    wrongCount: 0,
    correct: null,
    pass: null,
    chips,
    xp: xpFor(7 - count('skipped')),
    streak: { days: 8, keptToday: true, atRisk: false },
    track: {
      id: 'major-diatonic-chords',
      title: 'Major diatonic chords',
      done: 4,
      total: 12,
      unit: 'keys',
      nextLevelId: 'e-major',
      nextTitle: 'E major',
    },
    reviewNote,
    next: {
      levelId: 'e-major',
      label: completeFixture.cta,
      route: '/practice/e-major',
      run: null,
    },
    levelStatus: 'completed',
  };
}

/**
 * decisions.md 2026-10-03 circle run: the design fixture as key 4 of a run (`mid`), or as the
 * last key of the run (`end`: F major, 12 of 12, nothing next).
 */
export function circleRunFixture(at: 'mid' | 'end', skipped: readonly number[] = []): CompleteDto {
  const dto = completeDtoFixture(skipped);
  if (at === 'mid') {
    return {
      ...dto,
      run: 'circle',
      runPosition: 4,
      next: dto.next ? { ...dto.next, run: 'circle' } : null,
    };
  }
  return {
    ...dto,
    levelId: 'f-major',
    levelTitle: 'F major',
    shortTitle: 'F major',
    title: 'F major, complete',
    subtitle: "All seven diatonic chords. That's twelve keys around the circle.",
    run: 'circle',
    runPosition: 12,
    next: null,
    track: { ...dto.track, done: 12, nextLevelId: null, nextTitle: null },
  };
}

export function parseSkipped(raw: string | null): number[] {
  if (raw === null || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < 7);
}

function CompleteDevScreen() {
  const [params] = useSearchParams();
  const search = params.toString();
  // Remount on knob changes so the toggle and countdown restart.
  return <CompleteDevFixture key={search} params={params} />;
}

function CompleteDevFixture({ params }: { params: URLSearchParams }) {
  const skipped = parseSkipped(params.get('skipped'));
  const run = params.get('run');
  const complete =
    run === 'mid' || run === 'end' ? circleRunFixture(run, skipped) : completeDtoFixture(skipped);
  const [auto, setAuto] = useState(params.get('auto') !== '0');
  return (
    <CompleteView
      complete={complete}
      onAction={() => undefined}
      autoContinue={auto}
      onAutoContinueChange={setAuto}
      schedule={params.get('run') === '1' ? realSchedule : frozenSchedule}
    />
  );
}

export const devScreens: Record<string, ComponentType> = { complete: CompleteDevScreen };
