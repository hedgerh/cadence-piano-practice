// decisions.md 2026-10-21 "Songs from MIDI": the song screens — Wait mode lights the exact keys
// per hand and moves on only when they're all played (playing the other hand between steps);
// Play along schedules the song; the list imports a file and shows the reason a file fails.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import { SynthContext } from '../../audio/useAudio';
import { FakeMidiInput } from '../../midi/FakeMidiInput';
import { MidiHubContext } from '../../midi/hooks';
import { createMidiHub } from '../../midi/midiStore';
import { formatBeat, noteName, SongView } from './SongPage';
import { fileToBase64, importErrorText } from './SongsPage';
import type { Song } from './songModel';

vi.mock('../../lib/api', () => ({ api: {}, queryKey: (c: string) => [c] }));

const n = (beat: number, midi: number, dur = 1) => ({ beat, dur, midi, velocity: 80 });
const song: Song = {
  id: 'delilah-test',
  title: 'Delilah (test)',
  fileName: 'delilah.mid',
  importedAt: 0,
  tempos: [{ beat: 0, bpm: 120 }],
  bars: [
    { number: 1, beat: 0, beats: 4, num: 4, den: 4 },
    { number: 2, beat: 4, beats: 4, num: 4, den: 4 },
  ],
  left: [n(0, 27, 3.5), n(0, 39, 3.5), n(3.5, 46, 1)],
  right: [
    n(0, 51, 2),
    n(0, 55, 2),
    n(0, 60, 2),
    n(2, 51, 2),
    n(2, 55, 2),
    n(2, 60, 2),
    n(4, 51),
    n(4, 55),
    n(4, 58),
  ],
  pedal: [],
  lengthBeats: 8,
};

let device: FakeMidiInput;
let synth: NullSynth;

beforeEach(() => {
  vi.useFakeTimers();
  synth = new NullSynth();
  device = new FakeMidiInput();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderSong(node: ReactNode = <SongView song={song} />) {
  const hub = createMidiHub();
  hub.attach(device, 'device');
  render(
    <SynthContext.Provider value={synth}>
      <MidiHubContext.Provider value={hub}>
        <MemoryRouter>{node}</MemoryRouter>
      </MidiHubContext.Provider>
    </SynthContext.Provider>,
  );
}

const stateOf = (midi: number) =>
  screen
    .getByTestId('song-keyboard')
    .querySelector(`[data-midi="${midi}"]`)
    ?.getAttribute('data-state');

describe('Wait for me', () => {
  it('lights the right hand’s exact keys and waits for all of them', () => {
    renderSong();
    expect(screen.getByTestId('song-step').textContent).toMatch(/Bar 1 · beat 1 · step 1 of 3/);
    expect(screen.getByTestId('song-step').textContent).toMatch(/Right: E♭3 G3 C4/);
    expect(screen.getByTestId('song-step').textContent).toMatch(/≈ Cm\/E♭/);
    expect(stateOf(51)).toBe('hint');
    act(() => device.press(51));
    expect(stateOf(51)).toBe('correct');
    act(() => device.press(48)); // C3: the right letter in the wrong octave
    expect(stateOf(48)).toBe('far');
    expect(screen.getByTestId('song-step').textContent).toMatch(/Not in this step: C3/);
    expect(screen.getByTestId('song-step').textContent).toMatch(/step 1 of 3/);
    act(() => {
      device.press(55);
      device.press(60);
    });
    expect(screen.getByTestId('song-step').textContent).toMatch(/Bar 1 · beat 3 · step 2 of 3/);
    // The left hand's E♭ octave played itself with your chord.
    expect(synth.calls.map((c) => c.midi).sort()).toEqual([27, 39]);
  });

  it('both hands: the left hand’s keys are asked for too', () => {
    renderSong();
    fireEvent.click(screen.getByTestId('song-hands-both'));
    expect(screen.getByTestId('song-step').textContent).toMatch(/Left: E♭1 E♭2/);
    expect(stateOf(27)).toBe('chord');
    expect(screen.queryByTestId('song-other-hand')).toBeNull();
  });
});

describe('Play along', () => {
  it('counts in, then plays the other hand; Stop stops', async () => {
    renderSong();
    fireEvent.click(screen.getByTestId('song-mode-play'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('song-play'));
      await vi.advanceTimersByTimeAsync(0);
    });
    for (let t = 0; t < 4; t += 0.05) {
      synth.time = t;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(25);
      });
    }
    expect(synth.ticks.length).toBeGreaterThanOrEqual(4); // a bar of count-in
    expect(synth.calls.some((c) => c.midi === 27)).toBe(true);
    expect(synth.calls.some((c) => c.midi === 51)).toBe(false); // your hand is yours to play
    fireEvent.click(screen.getByTestId('song-stop'));
    expect(screen.getByTestId('song-play')).toBeTruthy();
  });
});

describe('helpers', () => {
  it('names notes and beats as players say them', () => {
    expect(noteName(51)).toBe('E♭3');
    expect(noteName(60)).toBe('C4');
    expect(formatBeat(0)).toBe('1');
    expect(formatBeat(2.5)).toBe('3½');
    expect(formatBeat(3.75)).toBe('4¾');
  });

  it('reads a file as base64 and turns IPC errors into the reason', async () => {
    expect(await fileToBase64(new Blob([new Uint8Array([77, 84, 104, 100])]))).toBe('TVRoZA==');
    expect(
      importErrorText(
        new Error(
          "Error invoking remote method 'songs.import': Error: That file isn't a MIDI file Cadence can read (not a MIDI file).",
        ),
      ),
    ).toBe("That file isn't a MIDI file Cadence can read (not a MIDI file).");
  });
});
