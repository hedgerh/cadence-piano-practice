import { minorPatternLesson, type Lesson } from '@cadence/content';
import { noteToMidi } from '@cadence/music';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import { CHORD_DUR, LEAD_IN } from '../../audio/player';
import { SynthContext } from '../../audio/useAudio';
import { fixtureLesson } from './dev';
import { LessonView, soundingInRow } from './LessonView';
import {
  HEAR_SPACING,
  scheduleSequence,
  sequenceTimeline,
  useLessonPlayback,
} from './useLessonPlayback';

afterEach(cleanup);

const lesson = minorPatternLesson();
const sounds = lesson.hear?.sounds ?? [];

describe('Hear both patterns timeline (ui.md §3: 14 triads, 0.55 s apart)', () => {
  it('starts every 0.55 s and ends when the last chord has rung', () => {
    expect(sounds).toHaveLength(14);
    const { starts, end } = sequenceTimeline(sounds);
    expect(HEAR_SPACING).toBe(0.55);
    starts.forEach((s, i) => expect(s).toBeCloseTo(LEAD_IN + i * 0.55, 9));
    expect(end).toBeCloseTo(LEAD_IN + 13 * 0.55 + CHORD_DUR, 9);
  });

  it('schedules each chord at t0 + i·0.55 on the synth clock', () => {
    const synth = new NullSynth();
    scheduleSequence(synth, sounds, 10);
    expect(synth.calls).toHaveLength(14 * 3);
    const first = sounds[0];
    const second = sounds[1];
    if (first?.type !== 'chord' || second?.type !== 'chord') throw new Error('chord sounds');
    expect(synth.calls.slice(0, 3).map((c) => [c.midi, c.at])).toEqual(
      first.notes.map((n) => [noteToMidi(n), 10]),
    );
    expect(synth.calls.slice(3, 6).map((c) => c.at)).toEqual([10.55, 10.55, 10.55]);
    expect(synth.calls[3]?.midi).toBe(noteToMidi(second.notes[0] ?? 'C4'));
  });

  it('maps a flattened sounding index onto its row', () => {
    expect(soundingInRow(lesson.rows, 0, 3)).toBe(3);
    expect(soundingInRow(lesson.rows, 1, 3)).toBeNull();
    expect(soundingInRow(lesson.rows, 1, 9)).toBe(2);
    expect(soundingInRow(lesson.rows, 0, null)).toBeNull();
  });
});

function Harness({ content }: { content: Lesson }) {
  const playback = useLessonPlayback(content.hear?.sounds ?? []);
  return (
    <LessonView
      lesson={content}
      backTo="/tracks/minor-diatonic-chords"
      sounding={playback.sounding}
      playing={playback.playing}
      onHear={playback.play}
      onCta={() => undefined}
    />
  );
}

describe('LessonView (Learn.dc.html)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders both chip rows with pivots, the bold bridge and the md legend', () => {
    render(
      <MemoryRouter>
        <LessonView
          lesson={fixtureLesson}
          backTo="/tracks/x"
          sounding={null}
          playing={false}
          onHear={() => undefined}
          onCta={() => undefined}
        />
      </MemoryRouter>,
    );
    const numerals = (r: number) =>
      Array.from(screen.getByTestId(`lesson-chips-${r}`).children).map((c) => c.textContent);
    expect(numerals(0)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(numerals(1)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
    expect(screen.getByTestId('callout').querySelector('strong')?.textContent).toBe('vi');
    expect(screen.getByText('diminished')).toBeTruthy();
    expect(screen.getByTestId('learn-cta').textContent).toBe('Got it — play A minor');
    expect(screen.getByTestId('lesson-chip-0-5').getAttribute('data-state')).toBe('minor');
  });

  it('plays the 14 triads in order, highlighting the sounding chip, disabled while playing', async () => {
    const synth = new NullSynth();
    render(
      <MemoryRouter>
        <SynthContext.Provider value={synth}>
          <Harness content={lesson} />
        </SynthContext.Provider>
      </MemoryRouter>,
    );
    const hear = screen.getByTestId<HTMLButtonElement>('learn-hear');
    expect(hear.disabled).toBe(false);
    fireEvent.click(hear);
    expect(hear.disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEAD_IN * 1000);
    });
    expect(synth.unlocked).toBe(true);
    expect(synth.calls).toHaveLength(42);
    expect(screen.getByTestId('lesson-chips-0').getAttribute('data-sounding')).toBe('0');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7 * HEAR_SPACING * 1000);
    });
    expect(screen.getByTestId('lesson-chips-0').hasAttribute('data-sounding')).toBe(false);
    expect(screen.getByTestId('lesson-chips-1').getAttribute('data-sounding')).toBe('0');
    expect(hear.disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(hear.disabled).toBe(false);
    expect(screen.getByTestId('lesson-chips-1').hasAttribute('data-sounding')).toBe(false);
  });
});
