// Task 12/13 — ChoiceDrill's step-driven model: labels, feedback copy (EarInterval:184–191 and
// docs/tasks/13), keyboard lighting, play-back matching (engine.md §5, §6.11), cadence gating.
import { initialMatchState, reduceMatch, type Midi } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import {
  autoPlaySounds,
  chipSize,
  chordNamesShown,
  chordShort,
  contextId,
  drillEyebrow,
  FOCUS_EYEBROW,
  feedbackCopy,
  feedbackMinWidth,
  litKeys,
  numeralsCaption,
  optionLabel,
  playbackSpec,
  playbackText,
  stageCopy,
  stageKindOf,
} from './choiceModel';
import type { EarQuestion } from './earDrillReducer';
import { earResultsView } from './earResults';
import { earCompleteFixture, earSessionFixture } from './fixtures';

const q = (levelId: string, stepId: string): EarQuestion => {
  const question = earSessionFixture(levelId, [stepId]).questions[0];
  if (!question) throw new Error('missing');
  return question;
};

/** Feed note-ons (sequence) or a held set (chord) through the play-back spec. */
function playsBack(question: EarQuestion, notes: readonly Midi[], held = false): boolean {
  const spec = playbackSpec(question);
  if (spec === null) return false;
  let state = initialMatchState(spec);
  if (held)
    return reduceMatch(spec, state, { type: 'held', held: new Set(notes) }).status === 'matched';
  for (const midi of notes) state = reduceMatch(spec, state, { type: 'noteOn', midi });
  return state.status === 'matched';
}

// decisions.md 2026-10-18 "Name the progression".
describe('name the progression', () => {
  const question = q('progressions-1', 'c-major-I-V-vi-IV');

  it('wide chips with nicknames, its own prompt and feedback', () => {
    expect(stageKindOf('progressions')).toBe('progressions');
    expect(chipSize('progressions')).toBe('wide');
    expect(optionLabel('progressions', 'I–V–vi–IV')).toEqual({
      primary: 'I–V–vi–IV',
      secondary: 'Four-chord pop',
    });
    expect(stageCopy('progressions', [question], question).prompt).toMatch(/Which progression/);
    expect(feedbackCopy('progressions', question, 'I–V–vi–IV', true)).toEqual({
      title: 'I–V–vi–IV — yes.',
      body: 'That was I–V–vi–IV: C – G – Am – F. Four-chord pop.',
    });
    expect(feedbackCopy('progressions', question, 'I–IV–V–I', false).body).toMatch(
      /You said I–IV–V–I/,
    );
  });

  it('lights the last chord; offers no play-back', () => {
    expect(litKeys(question)).toHaveLength(3);
    expect(playbackSpec(question)).toBeNull();
  });
});

describe('stage kinds and labels', () => {
  it('maps stage ids to label maps', () => {
    expect(stageKindOf('intervals')).toBe('intervals');
    expect(stageKindOf('scale-degrees')).toBe('degrees');
    expect(stageKindOf('chord-quality')).toBe('quality');
    expect(stageKindOf('chords-in-key')).toBe('numerals');
    expect(stageKindOf('find-the-key')).toBe('generic');
  });

  it('intervals: short id + INTERVALS name (EarInterval:120–133)', () => {
    expect(optionLabel('intervals', 'P4')).toEqual({ primary: 'P4', secondary: 'Perfect 4th' });
    expect(optionLabel('intervals', 'TT')).toEqual({ primary: 'TT', secondary: 'Tritone' });
  });

  it('degrees: the digit plus a short name', () => {
    const names = ['1', '2', '3', '4', '5', '6', '7'].map(
      (d) => optionLabel('degrees', d).secondary,
    );
    expect(names).toEqual([
      'Tonic',
      'Supertonic',
      'Mediant',
      'Subdominant',
      'Dominant',
      'Submediant',
      'Leading tone',
    ]);
  });

  it('quality: Major / Minor / Diminished', () => {
    expect(['major', 'minor', 'diminished'].map((o) => optionLabel('quality', o).primary)).toEqual([
      'Major',
      'Minor',
      'Diminished',
    ]);
  });
});

describe('feedback copy', () => {
  const p4 = q('intervals-3', 'up-C4-P4');

  it('intervals: EarInterval:189–190', () => {
    expect(feedbackCopy('intervals', p4, 'P4', true)).toEqual({
      title: 'Perfect 4th — yes.',
      body: "C up to F. 'Here Comes the Bride' — the first two notes. Nice ears.",
    });
    expect(feedbackCopy('intervals', p4, 'M3', false)).toEqual({
      title: 'Not quite. That was a perfect 4th.',
      body: "C up to F. 'Here Comes the Bride' — the first two notes. You said major 3rd — it will come back in review.",
    });
    expect(feedbackCopy('intervals', q('intervals-3', 'up-C4-P8'), 'P5', false).title).toBe(
      'Not quite. That was an octave.',
    );
  });

  it('degrees: "3 — yes. That\'s E in C major." / "Not quite. That was 3, the mediant."', () => {
    const three = q('scale-degrees-1', 'c-major-3');
    expect(feedbackCopy('degrees', three, '3', true)).toEqual({
      title: '3 — yes.',
      body: "That's E in C major.",
    });
    const wrong = feedbackCopy('degrees', three, '5', false);
    expect(wrong.title).toBe('Not quite. That was 3, the mediant.');
    expect(wrong.body).toBe(
      "That's E in C major. You said 5, the dominant — it will come back in review.",
    );
  });

  it('quality: "Minor — yes." / "Not quite. That was a diminished chord."', () => {
    const am = q('chord-quality-1', 'a-minor');
    expect(feedbackCopy('quality', am, 'minor', true).title).toBe('Minor — yes.');
    const dim = q('chord-quality-2', 'c-diminished');
    const wrong = feedbackCopy('quality', dim, 'minor', false);
    expect(wrong.title).toBe('Not quite. That was a diminished chord.');
    expect(wrong.body).toBe(
      'C diminished: C · E♭ · G♭. You said minor — it will come back in review.',
    );
  });
});

describe('keyboard lighting and play-back', () => {
  it('lights the sounding notes folded into the one-octave keyboard (C4–B4)', () => {
    expect(litKeys(q('intervals-3', 'up-C4-P4'))).toEqual([60, 65]);
    // EarInterval:168: the octave lights C once.
    expect(litKeys(q('intervals-3', 'up-C4-P8'))).toEqual([60]);
    expect(litKeys(q('intervals-5', 'up-G4-P5'))).toEqual([62, 67]);
    expect(litKeys(q('scale-degrees-1', 'c-major-3'))).toEqual([64]);
    expect(litKeys(q('chord-quality-1', 'a-minor'))).toEqual([60, 64, 69]);
  });

  it('play-back text: "C then F" · "E" · "A · C · E"', () => {
    expect(playbackText(q('intervals-3', 'up-C4-P4'))).toBe('C then F');
    expect(playbackText(q('scale-degrees-1', 'c-major-3'))).toBe('E');
    expect(playbackText(q('chord-quality-1', 'a-minor'))).toMatch(
      /^A · C · E$|^C · E · A$|^E · A · C$/,
    );
  });

  it('intervals: ordered notes in any octave (sequence anyOctave)', () => {
    const p4 = q('intervals-3', 'up-C4-P4');
    expect(playbackSpec(p4)).toEqual({ type: 'sequence', notes: ['C4', 'F4'], anyOctave: true });
    expect(playsBack(p4, [60, 65])).toBe(true);
    expect(playsBack(p4, [48, 77])).toBe(true);
    expect(playsBack(p4, [65, 60])).toBe(false);
    // A wrong note resets silently; starting again still counts.
    expect(playsBack(p4, [60, 62, 60, 65])).toBe(true);
  });

  it('degrees: the single note in any octave', () => {
    const three = q('scale-degrees-1', 'c-major-3');
    expect(playsBack(three, [76])).toBe(true);
    expect(playsBack(three, [65])).toBe(false);
  });

  it('chords: the pitch-class set, any voicing', () => {
    const am = q('chord-quality-1', 'a-minor');
    expect(playbackSpec(am)?.type).toBe('chord');
    expect(playsBack(am, [57, 60, 64], true)).toBe(true);
    expect(playsBack(am, [45, 64, 72, 69], true)).toBe(true);
    expect(playsBack(am, [57, 61, 64], true)).toBe(false);
  });
});

describe('prompt sounds (engine.md §7, Task 13 cadence gating)', () => {
  it('a first question in a key auto-plays the cadence, then the prompt', () => {
    const three = q('scale-degrees-1', 'c-major-3');
    const heard = new Set<string>();
    expect(autoPlaySounds(three, heard).map((s) => s.type)).toEqual(['cadence', 'notes']);
    heard.add(contextId(three) ?? '');
    expect(autoPlaySounds(three, heard).map((s) => s.type)).toEqual(['notes']);
    // A new key (L4: G and F major) plays its own cadence.
    expect(autoPlaySounds(q('scale-degrees-4', 'f-major-2'), heard).map((s) => s.type)).toEqual([
      'cadence',
      'notes',
    ]);
  });

  it('intervals have no context sound', () => {
    expect(autoPlaySounds(q('intervals-3', 'up-C4-P4'), new Set()).map((s) => s.type)).toEqual([
      'notes',
    ]);
  });

  it('interval prompt: C4 for 0.7 s, then the target at +0.8 s for 0.9 s', async () => {
    const synth = new NullSynth();
    const [sound] = autoPlaySounds(q('intervals-3', 'up-C4-P4'), new Set());
    if (!sound) throw new Error('no sound');
    await synth.play(sound);
    const [c, f] = synth.calls;
    expect(c?.midi).toBe(60);
    expect(f?.midi).toBe(65);
    expect((f?.at ?? 0) - (c?.at ?? 0)).toBeCloseTo(0.8, 9);
    expect(c?.dur).toBeCloseTo(0.7, 9);
    expect(f?.dur).toBeCloseTo(0.9, 9);
  });

  it('stage copy: EarInterval:29, 54–55, 68', () => {
    const questions = earSessionFixture('intervals-3', ['up-C4-P4', 'up-C4-M3']).questions;
    const copy = stageCopy('intervals', questions, questions[0]);
    expect(copy).toMatchObject({
      eyebrow: 'Name it, then play it back',
      play: 'Play',
      playAgain: 'Hear it again',
      prompt: 'Two notes, going up. The first one is always C.',
      greyed: 'Greyed-out intervals arrive in later levels.',
    });
    const l5 = earSessionFixture('intervals-5', ['up-C4-P4', 'up-G4-P5']).questions;
    expect(stageCopy('intervals', l5, l5[0]).prompt).toBe('Two notes, going up.');
    const l6 = earSessionFixture('intervals-6', ['down-C5-P4']).questions;
    expect(stageCopy('intervals', l6, l6[0]).prompt).toBe(
      'Two notes, going down. The first one is always C.',
    );
    const deg = earSessionFixture('scale-degrees-1', ['c-major-3']).questions;
    expect(stageCopy('degrees', deg, deg[0]).eyebrow).toBe('Key of C major');
  });
});

describe('ear results view (ui.md §3)', () => {
  it('pass: "+40 XP", teal/lavender strip, "Keep going — Level 4"', () => {
    const v = earResultsView(earCompleteFixture(true));
    expect(v.passed).toBe(true);
    expect(v.title).toBe('Intervals · Level 3, passed');
    expect(v.stats[2]?.value).toBe('+40 XP');
    expect(v.chips).toHaveLength(10);
    expect(v.chips.filter((c) => c.tone === 'lavender')).toHaveLength(1);
    expect(v.primary).toEqual({
      kind: 'next',
      label: 'Keep going — Level 4',
      levelId: 'intervals-4',
    });
  });

  // docs/decisions.md "Ear level replay".
  it('pass with a next level: "Practice Level 3 again" beside the primary, Done secondary', () => {
    const v = earResultsView(earCompleteFixture(true));
    expect(v.extra).toEqual({
      kind: 'practice',
      label: 'Practice Level 3 again',
      levelId: 'intervals-3',
    });
    expect(v.secondary).toEqual({ kind: 'done', label: 'Done for today' });
  });

  it('pass with nothing next: primary "Practice Level 3 again", secondary "Back to the map"', () => {
    const v = earResultsView(earCompleteFixture(true, { last: true }));
    expect(v.result).toBe('pass');
    expect(v.primary).toEqual({
      kind: 'practice',
      label: 'Practice Level 3 again',
      levelId: 'intervals-3',
    });
    expect(v.secondary).toEqual({
      kind: 'map',
      label: 'Back to the map',
      to: '/tracks/ear-training',
    });
    expect(v.extra).toBeNull();
  });

  it('fail and focus results have no "Practice again" extra', () => {
    expect(earResultsView(earCompleteFixture(false)).extra).toBeNull();
    expect(earResultsView(earCompleteFixture(true, { focus: true })).extra).toBeNull();
  });

  it('fail: "Not yet — 6 of 10" and "Try Level 3 again" on the same level', () => {
    const v = earResultsView(earCompleteFixture(false));
    expect(v.passed).toBe(false);
    expect(v.title).toBe('Not yet — 6 of 10');
    expect(v.primary).toEqual({
      kind: 'retry',
      label: 'Try Level 3 again',
      levelId: 'intervals-3',
    });
    expect(v.chips.filter((c) => c.tone === 'lavender')).toHaveLength(4);
    expect(v.drill).toEqual({
      kind: 'drill',
      label: 'Drill what you missed',
      levelId: 'intervals-3',
    });
  });

  // engine.md §4 focus rounds.
  it('pass with a miss offers "Drill what you missed"; a clean sweep does not', () => {
    expect(earResultsView(earCompleteFixture(true)).drill?.label).toBe('Drill what you missed');
    expect(earResultsView(earCompleteFixture(true, { missed: [] })).drill).toBeNull();
  });

  it('a hinted answer counts as a miss for the drill', () => {
    const dto = earCompleteFixture(true, { missed: [] });
    const chips = dto.chips.map((c, i) => (i === 3 ? { ...c, result: 'hinted' as const } : c));
    expect(earResultsView({ ...dto, chips }).drill?.kind).toBe('drill');
  });

  it('focus round: "Focus round", n of 10 right, no judgement, no +40, Drill again / Back', () => {
    const v = earResultsView(earCompleteFixture(true, { focus: true, missed: [4] }));
    expect(v.result).toBe('focus');
    expect(v.passed).toBe(false);
    expect(v.title).toBe('Focus round');
    expect(v.subtitle).toMatch(/^9 of 10 right\./);
    expect(v.stats.map((s) => s.value)).not.toContain('+40 XP');
    expect(v.stats.map((s) => s.label)).not.toContain('8 needed to pass');
    expect(v.primary).toEqual({ kind: 'drill', label: 'Drill again', levelId: 'intervals-3' });
    expect(v.secondary).toEqual({ kind: 'back', label: 'Back to Level 3', levelId: 'intervals-3' });
    expect(v.drill).toBeNull();
  });

  it('drill eyebrow: "Focus · the ones you missed" only for a focus round', () => {
    expect(drillEyebrow('misses', 'Name it, then play it back')).toBe(FOCUS_EYEBROW);
    expect(FOCUS_EYEBROW).toBe('Focus · the ones you missed');
    expect(drillEyebrow(null, 'Name it, then play it back')).toBe('Name it, then play it back');
  });
});

// Task 14 — Chords in a key (EarChord.dc.html; engine.md §2.2 `chords-in-key`).
describe('chords in a key (numerals)', () => {
  const iv = q('chords-in-key-2', 'g-major-IV');

  it('chips: numeral over the short chord name in the cadence key (EarChord:75–81)', () => {
    const labels = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'].map((n) =>
      optionLabel('numerals', n, { question: iv, visibility: 'all' }),
    );
    expect(labels.map((l) => l.secondary)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°']);
    expect(labels.map((l) => l.primary)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(chipSize('numerals')).toBe('chord');
    expect(feedbackMinWidth('numerals')).toBe(280);
    expect(feedbackMinWidth('intervals')).toBe(260);
  });

  it('minor keys name their own triads', () => {
    const am = q('chords-in-key-4', 'a-minor-i');
    expect(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'].map((n) => chordShort(am, n))).toEqual([
      'Am',
      'B°',
      'C',
      'Dm',
      'Em',
      'F',
      'G',
    ]);
  });

  it('visibility `num` hides the names; the caption says which (EarChord:83)', () => {
    expect(optionLabel('numerals', 'IV', { question: iv, visibility: 'num' })).toEqual({
      primary: 'IV',
      secondary: '',
    });
    expect(optionLabel('numerals', 'IV', { question: iv, visibility: 'name' }).secondary).toBe('C');
    expect(chordNamesShown('all')).toBe(true);
    expect(chordNamesShown('num')).toBe(false);
    expect(numeralsCaption('all')).toBe(
      'Chord names shown — switch to numerals only in Show me, like in practice.',
    );
    expect(numeralsCaption('num')).toMatch(/^Numerals only/);
  });

  it('feedback: numeral + chord name, body from content `explain` (EarChord:88–89)', () => {
    expect(feedbackCopy('numerals', iv, 'IV', true)).toEqual({
      title: "IV — yes, that's C major.",
      body: "The IV chord pulls gently away from home. In G, that's C · E · G.",
    });
    expect(feedbackCopy('numerals', iv, 'ii', false)).toEqual({
      title: 'Not quite. That was IV — C major.',
      body: "The IV chord pulls gently away from home. In G, that's C · E · G. You said ii — it will come back in review.",
    });
  });

  it('copy, keyboard lighting and chord play-back', () => {
    const copy = stageCopy('numerals', [iv], iv);
    expect(copy).toMatchObject({
      eyebrow: 'Key of G major',
      play: 'Hear the chord',
      playAgain: 'Hear the chord again',
      playAria: 'Hear the chord',
      prompt: 'Which chord did you hear?',
    });
    // EarChord:116 — C · E · G lit on the C4–B4 octave.
    expect(litKeys(iv)).toEqual([60, 64, 67]);
    expect(playbackText(iv)).toBe('C · E · G');
    expect(playsBack(iv, [48, 52, 55], true)).toBe(true);
  });
});
