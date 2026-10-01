import { describe, expect, it } from 'vitest';
import { ALL_DONE_CTA } from './plan.service';
import { playLevel } from './seed';
import type { Services } from './services';
import { onboarded } from './testing/harness';

function playBlock(services: Services, blockId: string): void {
  const block = services.plan.getToday().blocks.find((b) => b.id === blockId);
  if (!block) throw new Error('no block');
  playLevel(services, { levelId: block.levelId, kind: block.kind, planBlockId: block.id });
}

// HANDOFF §5 Today's plan; engine.md §4 PlanService and §4.T plan edge cases.
describe('PlanService.getToday', () => {
  it('first run → a single learn block (C major), no warm-up or review', () => {
    const { services } = onboarded();
    const today = services.plan.getToday();
    expect(today.blocks).toHaveLength(1);
    expect(today.blocks[0]).toMatchObject({
      type: 'learn',
      levelId: 'c-major',
      eyebrow: 'Learn · new key',
      title: 'C major · all 7 diatonic chords',
      blurb: 'Your first key. No sharps or flats.',
      estimateMin: 5,
      meta: '5 min · up next',
      route: '/practice/c-major',
    });
    expect(today.cta).toMatchObject({ label: 'Start C major', route: '/practice/c-major' });
    expect(today.allDone).toBe(false);
  });

  it('persists the plan and returns it unchanged on a second call the same day', () => {
    const { services, clock } = onboarded();
    const first = services.plan.getToday();
    clock.advanceMinutes(90);
    // progress elsewhere would change a freshly built plan; the persisted one is returned
    services.settings.enroll('minor-diatonic-chords');
    const second = services.plan.getToday();
    expect(second.blocks).toEqual(first.blocks);
    expect(services.repos.plans.get(first.day)?.blocks.map((b) => b.id)).toEqual(
      first.blocks.map((b) => b.id),
    );
  });

  it('reflects live block statuses: in progress → "Continue with", done → next block', () => {
    const { services } = onboarded();
    const block = services.plan.getToday().blocks[0];
    if (!block) throw new Error('no block');
    services.progress.startLevel(block.levelId, 'learn', block.id);
    const mid = services.plan.getToday();
    expect(mid.blocks[0]?.status).toBe('in_progress');
    expect(mid.blocks[0]?.meta).toBe('5 min · in progress');
    expect(mid.cta.label).toBe('Continue with C major');
  });

  it('all blocks done → "That\'s today — explore the tracks"', () => {
    const { services } = onboarded();
    const block = services.plan.getToday().blocks[0];
    if (!block) throw new Error('no block');
    playBlock(services, block.id);
    const today = services.plan.getToday();
    expect(today.allDone).toBe(true);
    expect(today.blocks[0]?.meta).toBe('5 min · done');
    expect(today.cta).toMatchObject({
      label: ALL_DONE_CTA.label,
      route: '/tracks',
      subtitle: 'Come back tomorrow to keep the streak.',
    });
    expect(today.cta.label).toBe("That's today — explore the tracks");
  });

  it('a block started without its id is still marked done (same level today)', () => {
    const { services } = onboarded();
    expect(services.plan.getToday().blocks[0]?.levelId).toBe('c-major');
    playLevel(services, { levelId: 'c-major', kind: 'free' });
    expect(services.plan.getToday().allDone).toBe(true);
  });

  it('alternates the learn slot between two active tracks across two days', () => {
    const { services, clock } = onboarded();
    const day1 = services.plan.getToday();
    expect(day1.blocks.find((b) => b.type === 'learn')?.levelId).toBe('c-major');
    playBlock(services, day1.blocks.find((b) => b.type === 'learn')?.id ?? '');

    clock.advanceDays(1);
    const day2 = services.plan.getToday();
    const learn2 = day2.blocks.find((b) => b.type === 'learn');
    expect(learn2).toMatchObject({
      levelId: 'intervals-1',
      eyebrow: 'Learn · new level',
      title: 'Intervals · Level 1',
      estimateMin: 3,
      route: '/ear/intervals-1',
    });
    expect(learn2?.blurb).toBe(
      'Hear two notes, name the distance. Ascending first, then descending. Unison, perfect 5th and octave, going up from C.',
    );
    // yesterday's C major is due → review block; warm-up needs a mastered level → none
    expect(day2.blocks.map((b) => b.type)).toEqual(['learn', 'review']);
    expect(day2.blocks[1]?.blurb).toBe('I, ii and 5 more are due. Quick pass.');
    playBlock(services, learn2?.id ?? '');

    clock.advanceDays(1);
    const day3 = services.plan.getToday();
    expect(day3.blocks.find((b) => b.type === 'learn')?.levelId).toBe('g-major');
    expect(day3.blocks.find((b) => b.type === 'learn')?.blurb).toBe(
      'Next stop on the circle of fifths. One sharp: F♯.',
    );
  });

  it('nothing due → no review block', () => {
    const { services, clock } = onboarded();
    playBlock(services, services.plan.getToday().blocks[0]?.id ?? '');
    clock.advanceDays(1);
    playLevel(services, { levelId: 'c-major', kind: 'free' }); // C now due in 3 days
    clock.advanceDays(1);
    const today = services.plan.getToday();
    expect(today.blocks.map((b) => b.type)).toEqual(['learn']);
  });

  it('review picks the level with the most due steps and names them', () => {
    const { services, clock } = onboarded();
    // C: one hinted step; G: two missed steps
    playLevel(services, { levelId: 'c-major', kind: 'free', hinted: ['d7'] });
    playLevel(services, { levelId: 'g-major', kind: 'free', hinted: ['d2', 'd7'] });
    clock.advanceDays(1);
    playLevel(services, { levelId: 'c-major', kind: 'free', hinted: ['d7'] });
    playLevel(services, { levelId: 'g-major', kind: 'free', hinted: ['d2', 'd7'] });
    clock.advanceDays(1);
    const review = services.plan.getToday().blocks.find((b) => b.type === 'review');
    // after the second pass C has 1 due step (vii°), G has 2 (ii, vii°)
    expect(review?.levelId).toBe('g-major');
    expect(review?.blurb).toBe('ii and vii° are due. Quick pass.');
  });

  it('warm-up = mastered level with the lowest last score; "Last time: 5 of 7 clean."', () => {
    const { services, clock } = onboarded();
    // Master C and G with three clean passes (days 0, 1, 4); tie on score → older completion.
    for (const [advance, hinted] of [
      [0, []],
      [1, []],
      [3, []],
    ] as const) {
      clock.advanceDays(advance);
      playLevel(services, { levelId: 'c-major', kind: 'free', hinted });
      playLevel(services, { levelId: 'g-major', kind: 'free', hinted });
    }
    expect(services.review.mastered('c-major')).toBe(true);
    expect(services.review.mastered('g-major')).toBe(true);
    const warm = services.plan.getToday();
    expect(warm.blocks.map((b) => b.type)).toEqual(['warmup', 'learn']);
    expect(warm.blocks[0]).toMatchObject({
      levelId: 'c-major',
      eyebrow: 'Warm-up',
      blurb: 'You know this one. Played clean, no hints.',
      estimateMin: 2,
    });
  });

  it('warm-up blurb reports the last score when it was not clean', () => {
    const { services, clock } = onboarded();
    playLevel(services, { levelId: 'c-major', kind: 'free' });
    clock.advanceDays(1);
    playLevel(services, { levelId: 'c-major', kind: 'free' });
    clock.advanceDays(3);
    playLevel(services, { levelId: 'c-major', kind: 'free' }); // all at 7 days → mastered
    // The blurb reads the last finished session; simulate a 5-of-7 pass on it.
    const last = services.progress.lastFinishedSession('c-major');
    expect(last?.stepsClean).toBe(7);
    services.repos.sessions.update(last?.id ?? '', { stepsClean: 5 });
    clock.advanceDays(1);
    const block = services.plan.getToday().blocks.find((b) => b.type === 'warmup');
    expect(block?.blurb).toBe('Last time: 5 of 7 clean.');
  });

  it('nothing to learn or review → one "Free play" block of a mastered level', () => {
    const { services, clock } = onboarded();
    services.settings.setTrackSettings({ trackId: 'ear-training', active: false });
    const content = services.content;
    const keys = content.levelOrder('major-diatonic-chords').map((l) => l.id);
    for (const advance of [0, 1, 3]) {
      clock.advanceDays(advance);
      for (const levelId of keys) playLevel(services, { levelId, kind: 'free' });
    }
    clock.advanceDays(1);
    const today = services.plan.getToday();
    expect(today.blocks).toHaveLength(1);
    expect(today.blocks[0]).toMatchObject({ type: 'warmup', eyebrow: 'Free play', kind: 'free' });
    expect(keys).toContain(today.blocks[0]?.levelId);
  });

  it('routes a lesson-first learn block to the lesson until it is seen', () => {
    const { services } = onboarded();
    services.settings.setTrackSettings({ trackId: 'major-diatonic-chords', active: false });
    services.settings.setTrackSettings({ trackId: 'ear-training', active: false });
    services.settings.enroll('minor-diatonic-chords');
    const today = services.plan.getToday();
    expect(today.blocks[0]).toMatchObject({
      levelId: 'a-minor',
      lessonFirst: true,
      route: '/tracks/minor-diatonic-chords/lesson',
    });
    expect(today.cta.lessonFirst).toBe(true);
    services.settings.markLessonSeen('minor-diatonic-chords');
    expect(services.plan.getToday().blocks[0]?.route).toBe('/practice/a-minor');
  });

  it('greets by local hour', () => {
    const morning = onboarded('2026-10-01T15:00:00Z'); // 08:00 PDT
    expect(morning.services.plan.getToday().greeting).toBe('Good morning, Harry.');
    const afternoon = onboarded('2026-10-01T21:00:00Z'); // 14:00 PDT
    expect(afternoon.services.plan.getToday().greeting).toBe('Good afternoon, Harry.');
  });
});
