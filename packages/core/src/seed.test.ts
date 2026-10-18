import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { seed } from './seed';
import { EVENING, TZ, createHarness } from './testing/harness';

function day8() {
  const h = createHarness(EVENING);
  seed(h.services, 'day8', { timezone: TZ });
  return h;
}

// engine.md §4.T: seed `day8` reproduces the design's Today exactly (Main.dc.html).
describe('seed day8 → Today (Main.dc.html)', () => {
  it('builds warm-up C major (done), learn A major, review G major (vii°)', () => {
    const { services } = day8();
    const today = services.plan.getToday();
    expect(today.greeting).toBe('Good evening, Harry.');
    expect(today.summary).toBe('3 blocks · ~10 min');
    expect(today.blocks.map((b) => [b.eyebrow, b.title, b.blurb, b.meta, b.status])).toEqual([
      [
        'Warm-up',
        'C major · all 7 diatonic chords',
        'You know this one. Played clean, no hints.',
        '2 min · done',
        'done',
      ],
      [
        'Learn · new key',
        'A major · all 7 diatonic chords',
        'Next stop on the circle of fifths. Three sharps: F♯, C♯, G♯.',
        '5 min · up next',
        'pending',
      ],
      [
        'Review · due today',
        'G major · all 7 diatonic chords',
        "You needed a hint on vii° last time. Let's lock it in.",
        '2 min',
        'pending',
      ],
    ]);
    expect(today.cta.label).toBe('Start A major');
    expect(today.cta.route).toBe('/practice/a-major');
  });

  it('has an 8-day streak kept today and 1,240 XP matching the ledger', () => {
    const { services } = day8();
    const me = services.settings.me();
    expect(me.streak).toEqual({ days: 8, keptToday: true, atRisk: false });
    expect(me.xpTotal).toBe(1240);
    // xp_total equals the ledger sum; day_log xp equals the ledger per day.
    const today = services.clock.today(TZ);
    let ledger = 0;
    for (let k = 0; k <= 7; k++) {
      const d = addDays(today, -k);
      const sum = services.repos.xp.sumByDay(d);
      expect(sum).toBeGreaterThan(0);
      expect(services.repos.dayLog.get(d)?.xp).toBe(sum);
      ledger += sum;
    }
    expect(ledger).toBe(1240);
  });

  it('shows C, G, D complete and Intervals L3 current on the track cards', () => {
    const { services } = day8();
    const cards = services.plan.getToday().tracks;
    const major = cards.find((c) => c.trackId === 'major-diatonic-chords');
    expect(major).toMatchObject({
      statusLabel: 'In progress',
      progressText: '3 of 12 keys · C, G, D',
      nextText: 'Next: A',
    });
    const minor = cards.find((c) => c.trackId === 'minor-diatonic-chords');
    expect(minor).toMatchObject({
      statusLabel: 'Ready to start',
      progressText: '0 of 12 keys',
      nextText: 'Starts with a 1-min lesson',
      enrolled: false,
    });
    const ear = cards.find((c) => c.trackId === 'ear-training');
    expect(ear?.currentLabel).toBe('Intervals · Level 3');
    expect(cards.find((c) => c.trackId === 'minor-scales')?.statusLabel).toBe('Ready to start');
  });

  it('renders the EarPath ladder copy (EarPath.dc.html)', () => {
    const { services } = day8();
    const o = services.progress.trackOverview('ear-training');
    expect(o.stages?.map((s) => [s.title, s.state, s.unlockText, s.progressText])).toEqual([
      ['Intervals', 'open', null, 'Level 3 of 5'],
      ['Intervals going down', 'locked', 'Unlocks after Intervals L5', null],
      ['Scale degrees', 'locked', 'Unlocks at Intervals L4', null],
      ['Chord quality', 'locked', 'Unlocks at Intervals L5', null],
      ['Chords in a key', 'locked', 'Unlocks after Scale degrees L3', null],
      ['Name the progression', 'locked', 'Unlocks after Chords in a key L3', null],
      ['Find the key', 'locked', 'Unlocks after Chords in a key L2', null],
    ]);
    expect(o.stages?.[0]?.levels.map((l) => l.state)).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
    ]);
    expect(o.upNext).toMatchObject({ levelId: 'intervals-3', label: 'Start Level 3' });
  });
});

// Task 04 acceptance / Complete.dc.html: A major with G♯° hinted.
describe('finishing A major with G♯° hinted (Complete.dc.html)', () => {
  it('yields the design CompleteDto', () => {
    const { services } = day8();
    const learn = services.plan.getToday().blocks.find((b) => b.type === 'learn');
    expect(learn).toBeDefined();
    const s = services.progress.startLevel('a-major', 'learn', learn?.id);
    s.steps.forEach((step, ordinal) => {
      const hinted = step.id === 'd7';
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: step.id,
        ordinal,
        result: hinted ? 'hinted' : 'clean',
        hintLevel: hinted ? 1 : 0,
      });
    });
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 134_000 });
    expect(done.title).toBe('A major, complete');
    expect(done.subtitle).toBe("All seven diatonic chords. That's four keys around the circle.");
    expect(done.cleanCount).toBe(6);
    expect(done.total).toBe(7);
    expect(done.xp).toEqual({ level: 40, steps: 35, playback: 0, total: 75, newTotal: 1315 });
    expect(done.track).toMatchObject({ done: 4, total: 12, nextTitle: 'E major' });
    expect(done.reviewNote).toBe("G♯° will come back in tomorrow's review until it's clean.");
    expect(done.streak).toEqual({ days: 8, keptToday: true, atRisk: false });
    expect(done.next).toEqual({
      levelId: 'e-major',
      label: 'Keep going — E major',
      route: '/practice/e-major',
      run: null,
    });
    expect(done.chips.map((c) => `${c.label} ${c.short} ${c.result}`)).toEqual([
      'I A clean',
      'ii Bm clean',
      'iii C♯m clean',
      'IV D clean',
      'V E clean',
      'vi F♯m clean',
      'vii° G♯° hinted',
    ]);
    // finishSession marks the plan block done.
    const today = services.plan.getToday();
    expect(today.blocks.find((b) => b.type === 'learn')?.status).toBe('done');
    expect(today.cta.label).toBe('Start G major');
  });
});

// Task 16 edge states: every key on the circle and every ear level complete.
describe("seed 'all-complete'", () => {
  it('completes the circle and the ladder; Today has no learn block and complete cards', () => {
    const { services } = createHarness();
    seed(services, 'all-complete', { timezone: TZ });
    const major = services.progress.trackOverview('major-diatonic-chords');
    expect(major.progress).toMatchObject({ done: 12, total: 12 });
    expect(major.nodes?.every((n) => n.state === 'done')).toBe(true);
    expect(major.upNext).toBeNull();
    const ear = services.progress.trackOverview('ear-training');
    expect(ear.stages?.every((s) => s.state === 'complete')).toBe(true);
    expect(ear.upNext).toBeNull();

    const today = services.plan.getToday();
    expect(today.blocks.some((b) => b.type === 'learn')).toBe(false);
    expect(today.resume).toBeNull();
    const cards = new Map(today.tracks.map((t) => [t.trackId, t]));
    expect(cards.get('major-diatonic-chords')?.status).toBe('complete');
    expect(cards.get('ear-training')?.status).toBe('complete');
  });
});
