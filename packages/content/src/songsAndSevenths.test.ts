// decisions.md 2026-10-18 "Songs", "7th chords", "Name the progression".
import { noteToMidi, voiceMotion } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { PROGRESSION_NICKNAMES, buildTracks, validateTracks } from './index';
import { at, stageById, trackById } from './testUtils';

const tracks = buildTracks();
const songs = trackById(tracks, 'songs');
const sevenths = trackById(tracks, 'diatonic-sevenths');
const twoFive = trackById(tracks, 'two-five-one');
const ear = trackById(tracks, 'ear-training');
const levelIn = (track: typeof songs, tonic: string) => {
  const level = track.levels?.find((l) => l.key?.tonic === tonic);
  if (!level) throw new Error(`no ${tonic} level`);
  return level;
};

describe('songs', () => {
  it('8 song lines per key, two hands, every voice at most a whole step', () => {
    expect(songs.group).toBe('Songs');
    for (const level of songs.levels ?? []) {
      expect(level.steps).toHaveLength(8);
      for (const step of level.steps) {
        expect(step.match).toMatchObject({ type: 'progression', freeBass: true, maxMove: 2 });
      }
    }
  });

  it('C major stars Let It Be; other keys say the songs are moved there', () => {
    const c = levelIn(songs, 'C');
    expect(c.note).toMatch(/^★ Original key of \*\*Let It Be\*\*\./);
    expect(c.steps.map((s) => s.name).slice(0, 3)).toEqual([
      'Let It Be · verse ★',
      'Let It Be · second line ★',
      'Don’t Stop Believin’ · verse',
    ]);
    expect(levelIn(songs, 'A').note).toMatch(/\*\*Stand By Me\*\* and \*\*Someone Like You\*\*/);
    expect(levelIn(songs, 'Bb').note).toMatch(/^Every song here, moved to B♭ major\./);
  });

  it('Someone Like You: V has its 3rd in the bass (E/G♯ in A)', () => {
    const step = levelIn(songs, 'A').steps.find((s) => s.id === 'someone-like-you');
    expect(step?.parts?.map((p) => `${p.label} ${p.sub ?? ''}`)).toEqual([
      'I A',
      'V⁶ E/G♯',
      'vi F♯m',
      'IV D',
    ]);
    expect(step?.match.type === 'progression' && step.match.chords[1]).toEqual({
      notes: ['E', 'G#', 'B'],
      bass: 'G#',
    });
  });

  it('Don’t Stop Believin’ turns through iii', () => {
    const step = levelIn(songs, 'E').steps.find((s) => s.id === 'dont-stop-turn');
    expect(step?.label).toBe('I – V – iii – IV');
    expect(step?.name).toBe('Don’t Stop Believin’ · the turn ★');
  });
});

describe('diatonic 7th chords', () => {
  it('7 four-note chords per key, labelled Imaj7..viiø7, coloured by the triad', () => {
    const c = at(sevenths.levels, 0);
    expect(c.id).toBe('c-major-sevenths');
    expect(c.steps.map((s) => s.label)).toEqual([
      'Imaj7',
      'ii7',
      'iii7',
      'IVmaj7',
      'V7',
      'vi7',
      'viiø7',
    ]);
    expect(c.steps[4]).toMatchObject({
      name: 'G dominant 7th',
      quality: 'major',
      match: { type: 'chord', notes: ['G', 'B', 'D', 'F'] },
    });
    expect(c.steps[6]?.quality).toBe('diminished');
  });
});

describe('ii–V–I', () => {
  it('four voices, the first inversion where asked, left-hand roots on the bass steps', () => {
    const c = at(twoFive.levels, 0);
    expect(c.steps.map((s) => s.id)).toEqual([
      'ii-V',
      'ii-V-I',
      'ii-V-I-first',
      'ii-V-I-bass',
      'turnaround',
      'turnaround-bass',
    ]);
    const first = c.steps[2];
    expect(first?.parts?.[0]).toMatchObject({ label: 'ii7⁶₅', sub: 'Dm7/F' });
    expect(first?.match.type === 'progression' && first.match.chords[0]?.bass).toBe('F');
    expect(c.steps[3]?.match).toMatchObject({ freeBass: true });
    expect(c.steps[4]?.label).toBe('Imaj7 – vi7 – ii7 – V7');
  });
});

describe('ear: name the progression', () => {
  const stage = stageById(ear, 'progressions');

  it('4 levels adding one progression each; every option has a nickname', () => {
    expect(stage.levels.map((l) => l.activeOptions)).toEqual([
      ['I–IV–V–I', 'I–V–vi–IV'],
      ['I–IV–V–I', 'I–V–vi–IV', 'I–vi–IV–V'],
      ['I–IV–V–I', 'I–V–vi–IV', 'I–vi–IV–V', 'ii–V–I'],
      ['I–IV–V–I', 'I–V–vi–IV', 'I–vi–IV–V', 'ii–V–I', 'vi–IV–I–V'],
    ]);
    const options = at(stage.levels, 3).activeOptions ?? [];
    expect(options.every((o) => PROGRESSION_NICKNAMES[o] !== undefined)).toBe(true);
    expect(at(stage.levels, 0).pool).toHaveLength(6);
  });

  it('questions play the voice-led chords after the key, spelled in the key', () => {
    const q = at(stageById(ear, 'progressions').levels, 0).pool?.find(
      (s) => s.id === 'c-major-I-V-vi-IV',
    );
    expect(q?.context).toEqual({ type: 'cadence', key: 'C', mode: 'major' });
    expect(q?.match).toMatchObject({ type: 'choice', answer: 'I–V–vi–IV' });
    expect(q?.explain).toBe('That was I–V–vi–IV: C – G – Am – F. Four-chord pop.');
    if (q?.play?.type !== 'chords') throw new Error('expected chords');
    const midi = q.play.chords.map((c) => c.map(noteToMidi));
    for (let i = 1; i < midi.length; i++) {
      const moves = voiceMotion(midi[i - 1] ?? [], midi[i] ?? []) ?? [];
      expect(Math.max(...moves.map(Math.abs))).toBeLessThanOrEqual(2);
    }
    const f = at(stageById(ear, 'progressions').levels, 0).pool?.find(
      (s) => s.id === 'f-major-I-IV-V-I',
    );
    expect(f?.play?.type === 'chords' && f.play.chords.flat().some((n) => n.startsWith('Bb'))).toBe(
      true,
    );
  });
});

// decisions.md 2026-10-18 "Minor progressions".
describe('minor progressions', () => {
  const minor = trackById(tracks, 'minor-progressions');

  it('12 minor keys; A♭ minor stands in for G♯ minor; the raised 7th is declared', () => {
    expect(minor.levels?.map((l) => l.key?.tonic)).toEqual([
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'Ab',
      'Eb',
      'Bb',
      'F',
      'C',
      'G',
      'D',
    ]);
    const a = at(minor.levels, 0);
    expect(a.extraNotes).toEqual(['G#']);
    expect(at(minor.levels, 5).extraNotes).toEqual(['G']);
  });

  it('i–V–i uses the major V; i–VII–VI–V keeps the natural VII; into V allows a minor 3rd', () => {
    const steps = at(minor.levels, 0).steps;
    const byId = (id: string) => steps.find((s) => s.id === id);
    expect(byId('i-V-i')?.match).toMatchObject({
      maxMove: 2,
      chords: [{ notes: ['A', 'C', 'E'] }, { notes: ['E', 'G#', 'B'] }, { notes: ['A', 'C', 'E'] }],
    });
    expect(byId('i-VII-VI-V')?.parts?.map((p) => p.sub)).toEqual(['Am', 'G', 'F', 'E']);
    expect(byId('i-iv-V-i')?.match).toMatchObject({ maxMove: 3 });
  });
});

describe('validator: extraNotes', () => {
  const edited = (edit: (levels: NonNullable<(typeof tracks)[number]['levels']>) => void) => {
    const copy = structuredClone(tracks);
    const t = copy.find((x) => x.id === 'minor-progressions');
    if (!t?.levels) throw new Error('missing');
    edit(t.levels);
    return validateTracks(copy).map((e) => e.message);
  };

  it('without the declared raised 7th, V is out of key; a declared note must be outside', () => {
    expect(
      edited((levels) => {
        delete levels[0]?.extraNotes;
      }),
    ).toContain('G# is not in A minor');
    expect(
      edited((levels) => {
        const a = levels[0];
        if (a) a.extraNotes = ['G#', 'C'];
      }),
    ).toContain('C is already in A minor');
  });
});
