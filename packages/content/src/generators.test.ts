// engine.md §2.2 generators — expectations from docs/tasks/02-content.md Acceptance and the
// designs (Practice.dc.html 140–146, Path.dc.html, Learn.dc.html, EarPath/EarInterval/EarChord).
import { type MatchSpec, hintFor, noteToMidi, pcNumber, scale } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { intervalAnchor, spellTriad } from './generators/earTrack';
import { numeralAscii, stepKey } from './ids';
import { buildTracks, groupTracks, stepNoun, stepNounPlural } from './index';
import { allLevels, allSteps, at, stageById, trackById } from './testUtils';
import { validateTracks } from './validate';

const tracks = buildTracks();
const majorTrack = trackById(tracks, 'major-diatonic-chords');
const minorTrack = trackById(tracks, 'minor-diatonic-chords');
const majorScalesTrack = trackById(tracks, 'major-scales');
const scalesTrack = trackById(tracks, 'minor-scales');
const inversionsTrack = trackById(tracks, 'inversions-voice-leading');
const ear = trackById(tracks, 'ear-training');

describe('buildTracks', () => {
  it('returns every track in display order', () => {
    expect(tracks.map((t) => t.id)).toEqual([
      'major-diatonic-chords',
      'minor-diatonic-chords',
      'inversions-voice-leading',
      'major-scales',
      'minor-scales',
      'ear-training',
    ]);
    expect(tracks.map((t) => t.available)).toEqual([true, true, false, true, true, true]);
    expect(tracks.map((t) => t.map)).toEqual([
      'circle-of-fifths',
      'circle-of-fifths',
      'circle-of-fifths',
      'circle-of-fifths',
      'circle-of-fifths',
      'ladder',
    ]);
  });

  it('passes the validator (engine.md §2.3)', () => {
    expect(validateTracks(tracks)).toEqual([]);
  });

  it('is deterministic across builds', () => {
    expect(buildTracks()).toEqual(tracks);
  });
});

describe('ids', () => {
  it('stepKey and numeralAscii', () => {
    expect(stepKey('a-major', 'd2')).toBe('a-major/d2');
    expect(numeralAscii('vii°')).toBe('viidim');
    expect(numeralAscii('ii°')).toBe('iidim');
    expect(numeralAscii('IV')).toBe('IV');
  });
});

describe('major-diatonic-chords', () => {
  it('has 12 levels clockwise from C', () => {
    expect(majorTrack.levels?.map((l) => l.id)).toEqual([
      'c-major',
      'g-major',
      'd-major',
      'a-major',
      'e-major',
      'b-major',
      'gb-major',
      'db-major',
      'ab-major',
      'eb-major',
      'bb-major',
      'f-major',
    ]);
    expect(at(majorTrack.levels, 9).title).toBe('E♭ major');
  });

  it('a-major matches Practice.dc.html lines 140–146 (names, labels, hint voicings)', () => {
    const level = at(majorTrack.levels, 3);
    expect(level.id).toBe('a-major');
    expect(level.key).toEqual({ tonic: 'A', mode: 'major' });
    const design = [
      { numeral: 'I', name: 'A major', keys: ['A3', 'C#4', 'E4'] },
      { numeral: 'ii', name: 'B minor', keys: ['B3', 'D4', 'F#4'] },
      { numeral: 'iii', name: 'C♯ minor', keys: ['C#4', 'E4', 'G#4'] },
      { numeral: 'IV', name: 'D major', keys: ['D3', 'F#3', 'A3'] },
      { numeral: 'V', name: 'E major', keys: ['E3', 'G#3', 'B3'] },
      { numeral: 'vi', name: 'F♯ minor', keys: ['F#3', 'A3', 'C#4'] },
      { numeral: 'vii°', name: 'G♯ diminished', keys: ['G#3', 'B3', 'D4'] },
    ] as const;
    expect(level.steps).toHaveLength(7);
    level.steps.forEach((step, i) => {
      const d = at(design, i);
      expect(step.id).toBe(`d${i + 1}`);
      expect(step.label).toBe(d.numeral);
      expect(step.name).toBe(d.name);
      expect(step.match.type).toBe('chord');
      expect(hintFor(step.match)?.keys).toEqual(d.keys.map((k) => noteToMidi(k)));
    });
    expect(level.steps.map((s) => s.quality)).toEqual([
      'major',
      'minor',
      'minor',
      'major',
      'major',
      'minor',
      'diminished',
    ]);
  });

  it('blurbs follow the Path.dc.html "Up next" copy', () => {
    expect(at(majorTrack.levels, 3).blurb).toBe(
      'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°',
    );
    expect(at(majorTrack.levels, 0).blurb).toBe(
      'No sharps or flats. Chords: C · Dm · Em · F · G · Am · B°',
    );
  });

  it('chord matches spell the root, third and fifth', () => {
    const steps = at(majorTrack.levels, 0).steps;
    expect(steps.map((s) => s.match)).toEqual<MatchSpec[]>([
      { type: 'chord', notes: ['C', 'E', 'G'] },
      { type: 'chord', notes: ['D', 'F', 'A'] },
      { type: 'chord', notes: ['E', 'G', 'B'] },
      { type: 'chord', notes: ['F', 'A', 'C'] },
      { type: 'chord', notes: ['G', 'B', 'D'] },
      { type: 'chord', notes: ['A', 'C', 'E'] },
      { type: 'chord', notes: ['B', 'D', 'F'] },
    ]);
  });
});

describe('minor-diatonic-chords', () => {
  it('starts at a-minor with i ii° III iv v VI VII', () => {
    const first = at(minorTrack.levels, 0);
    expect(first.id).toBe('a-minor');
    expect(first.steps.map((s) => s.label)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
    expect(minorTrack.levels?.map((l) => l.key?.tonic)).toEqual([
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      'Eb',
      'Bb',
      'F',
      'C',
      'G',
      'D',
    ]);
  });

  it('carries the Learn.dc.html lesson with pivots on vi (row 1) and i (row 2)', () => {
    const lesson = minorTrack.lesson;
    expect(lesson?.title).toBe('The minor pattern');
    expect(lesson?.eyebrow).toBe('Minor diatonic chords · before you play');
    expect(lesson?.cta).toBe('Got it — play A minor');
    const [row1, row2] = lesson?.rows ?? [];
    expect(row1?.label).toBe('Major (you know this)');
    expect(row1?.caption).toBe('C major: C · Dm · Em · F · G · Am · B°');
    expect(row2?.label).toBe('Minor (new)');
    expect(row2?.caption).toBe('A minor: Am · B° · C · Dm · Em · F · G');
    expect(row1?.chips.filter((c) => c.pivot).map((c) => c.numeral)).toEqual(['vi']);
    expect(row2?.chips.filter((c) => c.pivot).map((c) => c.numeral)).toEqual(['i']);
    expect(row2?.chips.map((c) => c.quality)).toEqual([
      'minor',
      'diminished',
      'major',
      'minor',
      'minor',
      'major',
      'major',
    ]);
    expect(lesson?.hear?.label).toBe('Hear both patterns');
    expect(lesson?.hear?.sounds).toHaveLength(14);
    expect(at(lesson?.hear?.sounds, 0)).toEqual({ type: 'chord', notes: ['C4', 'E4', 'G4'] });
    expect(at(lesson?.hear?.sounds, 7)).toEqual({ type: 'chord', notes: ['A3', 'C4', 'E4'] });
  });

  it('only the minor track has a lesson', () => {
    expect(tracks.filter((t) => t.lesson).map((t) => t.id)).toEqual(['minor-diatonic-chords']);
  });
});

describe('minor-scales', () => {
  it('12 levels with up/down sequences from placeScale', () => {
    expect(scalesTrack.levels).toHaveLength(12);
    const a = at(scalesTrack.levels, 0);
    expect(a.id).toBe('a-minor-scale');
    expect(a.steps.map((s) => s.id)).toEqual(['up', 'down']);
    expect(at(a.steps, 0).match).toEqual({
      type: 'sequence',
      notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
      direction: 'up',
      anyOctave: true,
    });
    expect(at(a.steps, 1).match).toEqual({
      type: 'sequence',
      notes: ['A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
      direction: 'down',
      anyOctave: true,
    });
    expect(at(a.steps, 0).name).toBe('A minor scale, going up');
  });

  it('is playable (available) and blurbs list the key signature and the notes', () => {
    expect(scalesTrack.available).toBe(true);
    expect(at(scalesTrack.levels, 0).blurb).toBe(
      'No sharps or flats. Notes: A · B · C · D · E · F · G',
    );
    const eb = at(scalesTrack.levels, 6);
    expect(eb.id).toBe('eb-minor-scale');
    expect(eb.blurb).toBe(
      'Six flats: B♭ · E♭ · A♭ · D♭ · G♭ · C♭. Notes: E♭ · F · G♭ · A♭ · B♭ · C♭ · D♭',
    );
  });
});

describe('major-scales', () => {
  it('12 levels clockwise from C major, up/down like the minor scales', () => {
    expect(majorScalesTrack.available).toBe(true);
    expect(majorScalesTrack.levels?.map((l) => l.id)).toEqual(
      ['c', 'g', 'd', 'a', 'e', 'b', 'gb', 'db', 'ab', 'eb', 'bb', 'f'].map(
        (t) => `${t}-major-scale`,
      ),
    );
    const g = at(majorScalesTrack.levels, 1);
    expect(g.title).toBe('G major');
    expect(g.blurb).toBe('One sharp: F♯. Notes: G · A · B · C · D · E · F♯');
    expect(at(g.steps, 0)).toMatchObject({
      id: 'up',
      name: 'G major scale, going up',
      match: {
        type: 'sequence',
        notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'],
        direction: 'up',
        anyOctave: true,
      },
    });
    expect(at(g.steps, 1).match).toMatchObject({
      notes: ['G4', 'F#4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3'],
    });
  });

  // decisions.md 2026-10-10 "Relative key on scale practice".
  it('each scale level notes its relative key, spelled from the scale', () => {
    expect(at(majorScalesTrack.levels, 0).note).toBe(
      'Relative minor: **A minor**. Same seven notes, starting on A.',
    );
    expect(at(majorScalesTrack.levels, 6).note).toBe(
      'Relative minor: **E♭ minor**. Same seven notes, starting on E♭.',
    );
    expect(at(scalesTrack.levels, 0).note).toBe(
      'Relative major: **C major**. Same seven notes, starting on C.',
    );
    expect(scalesTrack.levels?.map((l) => /\*\*(.+)\*\*/.exec(l.note ?? '')?.[1])).toEqual([
      'C major',
      'G major',
      'D major',
      'A major',
      'E major',
      'B major',
      'G♭ major',
      'D♭ major',
      'A♭ major',
      'E♭ major',
      'B♭ major',
      'F major',
    ]);
  });

  it('every placed scale stays on the two-octave practice keyboard (C3..B4)', () => {
    for (const level of [...(majorScalesTrack.levels ?? []), ...(scalesTrack.levels ?? [])]) {
      for (const step of level.steps) {
        if (step.match.type !== 'sequence') throw new Error('scale steps are sequences');
        for (const n of step.match.notes) {
          expect(noteToMidi(n)).toBeGreaterThanOrEqual(48);
          expect(noteToMidi(n)).toBeLessThanOrEqual(71);
        }
      }
    }
  });
});

describe('groups (library sections)', () => {
  it('every track names a group; tracks of a group are adjacent in display order', () => {
    expect(groupTracks(tracks).map((g) => [g.group, g.tracks.map((t) => t.id)])).toEqual([
      ['Chords', ['major-diatonic-chords', 'minor-diatonic-chords', 'inversions-voice-leading']],
      ['Scales', ['major-scales', 'minor-scales']],
      ['Ear training', ['ear-training']],
    ]);
    const order = tracks.map((t) => t.group);
    const seen = new Set<string>();
    order.forEach((g, i) => {
      if (i > 0 && order[i - 1] !== g) expect(seen.has(g)).toBe(false);
      seen.add(g);
    });
  });

  it('groupTracks keeps first-appearance order for any list', () => {
    const list = [
      { id: 'a', group: 'X' },
      { id: 'b', group: 'Y' },
      { id: 'c', group: 'X' },
    ];
    expect(groupTracks(list).map((g) => [g.group, g.tracks.map((t) => t.id)])).toEqual([
      ['X', ['a', 'c']],
      ['Y', ['b']],
    ]);
  });
});

describe('stepNoun', () => {
  it('chords for chord/voicing levels, scales for sequence levels, steps otherwise', () => {
    expect(stepNoun(at(majorTrack.levels, 0).steps)).toBe('chord');
    expect(stepNoun(at(inversionsTrack.levels, 0).steps)).toBe('chord');
    expect(stepNoun(at(scalesTrack.levels, 0).steps)).toBe('scale');
    expect(stepNoun([])).toBe('step');
    expect(stepNoun([{ match: { type: 'choice', answer: 'a', options: ['a'] } }])).toBe('step');
    expect(stepNounPlural('scale')).toBe('scales');
  });
});

describe('inversions-voice-leading', () => {
  it('12 major levels × 9 voicing steps, bass note per inversion', () => {
    expect(inversionsTrack.levels).toHaveLength(12);
    const c = at(inversionsTrack.levels, 0);
    expect(c.id).toBe('c-major-inversions');
    expect(c.steps.map((s) => s.id)).toEqual([
      'I-root',
      'I-first',
      'I-second',
      'IV-root',
      'IV-first',
      'IV-second',
      'V-root',
      'V-first',
      'V-second',
    ]);
    expect(c.steps.slice(0, 3).map((s) => s.match)).toEqual<MatchSpec[]>([
      { type: 'voicing', notes: ['C4', 'E4', 'G4'] },
      { type: 'voicing', notes: ['E3', 'G3', 'C4'] },
      { type: 'voicing', notes: ['G3', 'C4', 'E4'] },
    ]);
  });

  it('every voicing stays on the practice keyboard C3..B4', () => {
    for (const level of inversionsTrack.levels ?? []) {
      for (const step of level.steps) {
        if (step.match.type !== 'voicing') throw new Error('expected voicing');
        for (const n of step.match.notes) {
          expect(noteToMidi(n)).toBeGreaterThanOrEqual(48);
          expect(noteToMidi(n)).toBeLessThanOrEqual(71);
        }
      }
    }
  });
});

describe('ear-training', () => {
  const stages = ear.stages ?? [];

  it('five stages with the level counts and unlocks from engine.md §2.2', () => {
    expect(stages.map((s) => [s.id, s.levels.length])).toEqual([
      ['intervals', 6],
      ['scale-degrees', 4],
      ['chord-quality', 3],
      ['chords-in-key', 4],
      ['find-the-key', 3],
    ]);
    expect(stages.map((s) => s.unlock ?? null)).toEqual([
      null,
      { stage: 'intervals', level: 4 },
      { stage: 'intervals', level: 5 },
      { stage: 'scale-degrees', level: 4 },
      { stage: 'chords-in-key', level: 3 },
    ]);
  });

  it('stage titles and blurbs come from EarPath.dc.html', () => {
    expect(stages.map((s) => s.title)).toEqual([
      'Intervals',
      'Scale degrees',
      'Chord quality',
      'Chords in a key',
      'Find the key',
    ]);
    expect(stageById(ear, 'intervals').blurb).toBe(
      'Hear two notes, name the distance. Ascending first, then descending.',
    );
  });

  it('pass is 8/10, except find-the-key at 4/5; ear levels draw from a pool', () => {
    for (const stage of stages) {
      for (const level of stage.levels) {
        expect(level.pass).toEqual(
          stage.id === 'find-the-key' ? { correct: 4, of: 5 } : { correct: 8, of: 10 },
        );
        expect(level.steps).toEqual([]);
        expect(level.pool?.length).toBeGreaterThan(0);
      }
    }
  });

  it('intervals: activeOptions per level, L3 = the EarInterval.dc.html set', () => {
    const levels = stageById(ear, 'intervals').levels;
    expect(levels.map((l) => l.activeOptions)).toEqual([
      ['P1', 'P5', 'P8'],
      ['P1', 'm3', 'M3', 'P5', 'P8'],
      ['P1', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'],
      ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'P8'],
      ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
      ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
    ]);
    expect(levels.map((l) => l.pool?.length)).toEqual([3, 5, 7, 10, 65, 52]);
    const p4 = at(levels, 2).pool?.find((s) => s.label === 'P4');
    expect(p4).toMatchObject({
      id: 'up-C4-P4',
      name: 'Perfect 4th',
      play: { type: 'notes', notes: ['C4', 'F4'], gapMs: 800 },
      match: { type: 'choice', answer: 'P4' },
      explain: "C up to F. 'Here Comes the Bride' — the first two notes.",
    });
    if (p4?.match.type !== 'choice') throw new Error('expected choice');
    expect(p4.match.options).toHaveLength(13);
    const down = at(at(levels, 5).pool, 3);
    expect(down.play).toEqual({ type: 'notes', notes: ['C5', 'A4'], gapMs: 800 });
    expect(down.explain).toBe("C down to A. 'Hey Jude' — the first two notes.");
  });

  it('intervals: every step names an anchor tune after the where-sentence', () => {
    const levels = stageById(ear, 'intervals').levels;
    for (const level of levels) {
      const dir = level.id === 'intervals-6' ? 'down' : 'up';
      for (const step of level.pool ?? []) {
        if (step.match.type !== 'choice') throw new Error('expected choice');
        const anchor = intervalAnchor(
          step.match.answer as Parameters<typeof intervalAnchor>[0],
          dir,
        );
        expect(step.explain).toMatch(/^[A-G][♯♭]?( up| down|, then)/);
        expect(step.explain?.endsWith(` ${anchor}`)).toBe(true);
      }
    }
    const up = at(levels, 4).pool ?? [];
    expect(new Set(up.slice(0, 13).map((s) => intervalAnchor(s.label as 'P1', 'up'))).size).toBe(
      13,
    );
    expect(at(at(levels, 0).pool, 0).explain).toBe('C, then C again. Same note twice.');
    expect(intervalAnchor('TT', 'down')).toBe('Hear it, then sing it back before you answer.');
  });

  it('scale degrees: cadence context, one note in C4..B4, choice 1..7', () => {
    const levels = stageById(ear, 'scale-degrees').levels;
    expect(levels.map((l) => l.activeOptions)).toEqual([
      ['1', '3', '5'],
      ['1', '2', '3', '4', '5'],
      ['1', '2', '3', '4', '5', '6', '7'],
      ['1', '2', '3', '4', '5', '6', '7'],
    ]);
    expect(at(levels, 3).pool).toHaveLength(14);
    const fourth = at(levels, 3).pool?.find((s) => s.id === 'f-major-4');
    expect(fourth).toMatchObject({
      label: '4',
      context: { type: 'cadence', key: 'F', mode: 'major' },
      play: { type: 'notes', notes: ['Bb4'], gapMs: 0 },
      match: { type: 'choice', answer: '4', options: ['1', '2', '3', '4', '5', '6', '7'] },
    });
  });

  it('chord quality: L1 maj/min, L2 adds dim, L3 12 roots × 3 qualities × 3 inversions', () => {
    const levels = stageById(ear, 'chord-quality').levels;
    expect(levels.map((l) => l.pool?.length)).toEqual([14, 21, 108]);
    expect(levels.map((l) => l.activeOptions)).toEqual([
      ['major', 'minor'],
      ['major', 'minor', 'diminished'],
      ['major', 'minor', 'diminished'],
    ]);
    const bbMinor = at(levels, 0).pool?.find((s) => s.id === 'bb-minor');
    expect(bbMinor?.play).toEqual({ type: 'chord', notes: ['Bb3', 'Db4', 'F4'] });
    expect(spellTriad('Eb', 'diminished')).toMatchObject({ root: 'D#', third: 'F#', fifth: 'A' });
  });

  it('chords in a key: numerals, cadence context and EarChord.dc.html explain copy', () => {
    const levels = stageById(ear, 'chords-in-key').levels;
    expect(at(levels, 0).activeOptions).toEqual(['I', 'IV', 'V', 'vi']);
    expect(at(levels, 3).activeOptions).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
    const iv = at(levels, 1).pool?.find((s) => s.label === 'IV');
    expect(iv).toMatchObject({
      id: 'g-major-IV',
      name: 'C major',
      context: { type: 'cadence', key: 'G', mode: 'major' },
      play: { type: 'chord', notes: ['C4', 'E4', 'G4'] },
      explain: "The IV chord pulls gently away from home. In G, that's C · E · G.",
    });
    const vii = at(levels, 1).pool?.find((s) => s.label === 'vii°');
    expect(vii?.id).toBe('g-major-viidim');
    expect(vii?.explain).toContain('F♯ · A · C');
    const minorV = at(levels, 3).pool?.find((s) => s.id === 'a-minor-v');
    expect(minorV?.explain).toContain('In A minor');
  });

  it('find the key: root then major/minor, tonic-triad hint, phrase play', () => {
    const levels = stageById(ear, 'find-the-key').levels;
    expect(levels.map((l) => l.pool?.length)).toEqual([24, 48, 48]);
    const step = at(at(levels, 0).pool, 2);
    expect(step.id).toBe('c-minor-1');
    expect(step.match).toEqual({
      type: 'root',
      note: 'C',
      then: { type: 'choice', answer: 'minor', options: ['major', 'minor'] },
    });
    expect(step.hint).toEqual({ type: 'chord', notes: ['C4', 'Eb4', 'G4'] });
    expect(step.play?.type).toBe('phrase');
  });

  it('every ear sound note is a real note in its key where a level has one', () => {
    for (const level of allLevels(ear)) {
      if (!level.key) continue;
      const pcs = new Set(scale(level.key).map(pcNumber));
      for (const step of allSteps(level)) {
        if (step.play?.type !== 'notes') continue;
        for (const n of step.play.notes) expect(pcs.has(noteToMidi(n) % 12)).toBe(true);
      }
    }
  });
});
