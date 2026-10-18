import { describe, expect, it } from 'vitest';
import { addDays, daysBetween } from './dates';
import type { StepProgressRow, StepResult } from './ports';
import {
  diatonicSeventhsLevel,
  inversionShapesLevel,
  keyLevel,
  smoothProgressionsLevel,
  songsLevel,
} from '@cadence/content';
import { INTERVALS, type ReviewNoteResult, schedule, stepShort } from './review.service';
import { TZ, onboarded, testContent } from './testing/harness';

const base = { trackId: 't', levelId: 'l', stepId: 's', now: 0 };

function run(
  results: StepResult[],
  start = '2026-10-01',
): Array<{ offset: number; row: StepProgressRow }> {
  let prev: StepProgressRow | null = null;
  let today = start;
  const out: Array<{ offset: number; row: StepProgressRow }> = [];
  for (const result of results) {
    const row: StepProgressRow = { ...schedule({ ...base, prev, result, today }), id: 'x' };
    out.push({ offset: daysBetween(today, row.dueOn ?? today), row });
    prev = row;
    today = row.dueOn ?? today;
  }
  return out;
}

// HANDOFF §5 review scheduling; engine.md §4 ReviewService.
describe('schedule (pure)', () => {
  it('five consecutive clean results produce due offsets 1, 3, 7, 14, 30', () => {
    expect(INTERVALS).toEqual([1, 3, 7, 14, 30]);
    const out = run(['clean', 'clean', 'clean', 'clean', 'clean']);
    expect(out.map((o) => o.offset)).toEqual([1, 3, 7, 14, 30]);
    expect(out.map((o) => o.row.intervalIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(out.map((o) => o.row.intervalDays)).toEqual([1, 3, 7, 14, 30]);
  });

  it('stays at 30 days after the fifth clean', () => {
    const out = run(['clean', 'clean', 'clean', 'clean', 'clean', 'clean']);
    expect(out[5]?.offset).toBe(30);
    expect(out[5]?.row.intervalIndex).toBe(4);
  });

  it.each<StepResult>(['hinted', 'skipped', 'marked', 'wrong'])(
    '%s resets to due tomorrow (index −1, 1 day)',
    (result) => {
      const out = run(['clean', 'clean', 'clean', result]);
      expect(out[3]?.offset).toBe(1);
      expect(out[3]?.row).toMatchObject({ intervalIndex: -1, intervalDays: 1, lastResult: result });
      // the next clean starts over at 1 day
      const after = run(['clean', 'clean', 'clean', result, 'clean']);
      expect(after[4]?.offset).toBe(1);
    },
  );

  it('counts clean / hinted / wrong and seen', () => {
    const out = run(['clean', 'hinted', 'wrong', 'skipped', 'marked']);
    expect(out[4]?.row).toMatchObject({
      timesSeen: 5,
      timesClean: 1,
      timesHinted: 1,
      timesWrong: 1,
    });
  });

  it('a repeated clean answer in the same session does not advance twice', () => {
    const first = {
      ...schedule({ ...base, prev: null, result: 'clean', today: '2026-10-01' }),
      id: 'x',
    };
    const again = schedule({
      ...base,
      prev: first,
      result: 'clean',
      today: '2026-10-01',
      repeatInSession: true,
    });
    expect(again.intervalIndex).toBe(0);
    expect(again.dueOn).toBe('2026-10-02');
    expect(again.timesClean).toBe(2);
    const miss = schedule({
      ...base,
      prev: first,
      result: 'wrong',
      today: '2026-10-01',
      repeatInSession: true,
    });
    expect(miss.intervalIndex).toBe(-1);
  });
});

describe('ReviewService', () => {
  it('a level is mastered only when every step has interval_days ≥ 7', () => {
    const { services, clock } = onboarded();
    const level = testContent().requireLevel('c-major').level;
    const playAll = (except?: string): void => {
      for (const step of level.steps) {
        services.review.record({
          trackId: 'major-diatonic-chords',
          levelId: 'c-major',
          stepId: step.id,
          result: step.id === except ? 'hinted' : 'clean',
        });
      }
    };
    playAll(); // 1 day
    clock.advanceDays(1);
    playAll(); // 3 days
    expect(services.review.mastered('c-major')).toBe(false);
    clock.advanceDays(3);
    playAll('d7'); // six at 7 days, vii° back to 1
    expect(services.review.mastered('c-major')).toBe(false);
    clock.advanceDays(1);
    playAll(); // vii° → 1, others → 14
    expect(services.review.mastered('c-major')).toBe(false);
    const vii = (): void => {
      services.review.record({
        trackId: 'major-diatonic-chords',
        levelId: 'c-major',
        stepId: 'd7',
        result: 'clean',
      });
    };
    clock.advanceDays(1);
    vii(); // vii° → 3 days
    expect(services.review.mastered('c-major')).toBe(false);
    clock.advanceDays(3);
    vii(); // vii° → 7 days
    expect(services.repos.stepProgress.get('c-major', 'd7')?.intervalDays).toBe(7);
    expect(services.review.mastered('c-major')).toBe(true);
  });

  it('lists due steps and per-level due counts for today', () => {
    const { services, clock } = onboarded();
    services.review.record({
      trackId: 'major-diatonic-chords',
      levelId: 'c-major',
      stepId: 'd1',
      result: 'hinted',
    });
    services.review.record({
      trackId: 'major-diatonic-chords',
      levelId: 'c-major',
      stepId: 'd2',
      result: 'clean',
    });
    services.review.record({
      trackId: 'major-diatonic-chords',
      levelId: 'g-major',
      stepId: 'd3',
      result: 'wrong',
    });
    expect(services.review.dueSteps()).toHaveLength(0);
    clock.advanceDays(1);
    const today = clock.today(TZ);
    expect(services.review.dueSteps().map((r) => r.stepId)).toEqual(['d1', 'd2', 'd3']);
    expect(services.review.dueCountByLevel()).toEqual([
      { levelId: 'c-major', trackId: 'major-diatonic-chords', count: 2, earliestDueOn: today },
      { levelId: 'g-major', trackId: 'major-diatonic-chords', count: 1, earliestDueOn: today },
    ]);
    expect(addDays(today, 0)).toBe(today);
  });

  it('reviewNote copy (engine.md §4)', () => {
    const { services } = onboarded();
    const a = testContent().requireLevel('a-major').level;
    const results = (missed: string[]): ReviewNoteResult[] =>
      a.steps.map((s) => ({
        stepId: s.id,
        result: missed.includes(s.id) ? 'hinted' : 'clean',
      }));
    expect(services.review.reviewNote(a, results(['d7']), 1)).toBe(
      "G♯° will come back in tomorrow's review until it's clean.",
    );
    const b = testContent().requireLevel('c-major').level;
    const twoMissed = b.steps.map((s): ReviewNoteResult => ({
      stepId: s.id,
      result: s.id === 'd2' || s.id === 'd7' ? 'skipped' : 'clean',
    }));
    expect(services.review.reviewNote(b, twoMissed, 1)).toBe('Dm and B° come back tomorrow.');
    expect(services.review.reviewNote(a, results([]), 3)).toBe(
      'All seven are clean — next review in 3 days.',
    );
    expect(services.review.reviewNote(a, results([]), 1)).toBe(
      'All seven are clean — next review tomorrow.',
    );
    // Focus rounds often drill two steps.
    const two = results([]).slice(0, 2);
    expect(services.review.reviewNote(a, two, 1)).toBe('Both are clean — next review tomorrow.');
  });
});

// decisions.md 2026-10-11: Complete chips and review notes name every step type shortly.
describe('stepShort', () => {
  it('chords, inversions as slash chords, climbs as their chord, progressions as symbols', () => {
    const f = { tonic: 'F', mode: 'major' } as const;
    expect(stepShort(keyLevel(f).steps[1] ?? never())).toBe('Gm');
    const shapes = inversionShapesLevel(f).steps;
    expect(shapes.slice(0, 4).map(stepShort)).toEqual(['F', 'B♭', 'C', 'Dm']);
    expect(stepShort(shapes[4] ?? never())).toBe('F/A');
    const smooth = smoothProgressionsLevel(f).steps;
    expect(stepShort(smooth[0] ?? never())).toBe('F – B♭ – F');
    expect(stepShort(smooth[3] ?? never())).toBe('F/A – B♭ – C – F');
  });

  // decisions.md 2026-10-18 "7th chords" and "Songs".
  it('7th chords by their symbols; song lines by their chords, slash basses included', () => {
    const f = { tonic: 'F', mode: 'major' } as const;
    expect(diatonicSeventhsLevel(f).steps.map(stepShort)).toEqual([
      'Fmaj7',
      'Gm7',
      'Am7',
      'B♭maj7',
      'C7',
      'Dm7',
      'Eø7',
    ]);
    const someone = songsLevel({ tonic: 'A', mode: 'major' }).steps[5];
    expect(stepShort(someone ?? never())).toBe('A – E/G♯ – F♯m – D');
  });
});

function never(): never {
  throw new Error('missing step');
}
