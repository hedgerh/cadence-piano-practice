// decisions.md 2026-10-18 "Jam": the page plays the chosen chart through the synth, follows the
// beat, lights chord and scale tones, and remembers its settings.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import { SynthContext } from '../../audio/useAudio';
import { JamView } from './JamPage';
import { PREFS_KEY, parsePrefs } from './jamPrefs';

vi.mock('../shared/hooks', () => ({ useMe: () => ({ data: undefined }) }));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderJam() {
  const synth = new NullSynth();
  render(
    <SynthContext.Provider value={synth}>
      <MemoryRouter initialEntries={['/jam']}>
        <JamView streakDays={0} xp={0} />
      </MemoryRouter>
    </SynthContext.Provider>,
  );
  return synth;
}

const keyStates = () =>
  [...screen.getByTestId('jam-keyboard').querySelectorAll('[data-midi]')].map((k) =>
    k.getAttribute('data-state'),
  );

describe('Jam', () => {
  it('shows the default chart; Start counts in and schedules the backing; Stop stops', async () => {
    const synth = renderJam();
    const chart = screen.getByTestId('jam-chart');
    expect(within(chart).getAllByText(/^(I|V|vi|IV)$/)).toHaveLength(4);
    expect(screen.getByTestId('jam-status').textContent).toMatch(/Press Start/);

    await act(async () => {
      fireEvent.click(screen.getByTestId('jam-start'));
      await vi.advanceTimersByTimeAsync(0);
    });
    for (let t = 0; t < 3; t += 0.05) {
      synth.time = t;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(25);
      });
    }
    // One bar of clicks at 80 BPM (0.75 s a beat), then the loop with its bass.
    expect(synth.ticks.slice(0, 4).map((x) => x.accent)).toEqual([true, false, false, false]);
    expect(synth.calls.some((c) => c.midi === 36 && c.velocity !== undefined)).toBe(true);
    expect(screen.getByTestId('jam-stop')).toBeTruthy();

    fireEvent.click(screen.getByTestId('jam-stop'));
    expect(screen.getByTestId('jam-start')).toBeTruthy();
  });

  it('guides: chord tones and scale tones on the keyboard, each switchable', () => {
    renderJam();
    expect(keyStates()).toContain('chord');
    expect(keyStates()).toContain('scale');
    fireEvent.click(screen.getByTestId('jam-toggle-chord'));
    expect(keyStates()).not.toContain('chord');
    fireEvent.click(screen.getByTestId('jam-toggle-scale'));
    expect(keyStates().every((s) => s === 'idle')).toBe(true);
  });

  it('a new progression and key update the chart and are remembered', () => {
    renderJam();
    fireEvent.change(screen.getByTestId('jam-preset'), { target: { value: 'twelve-bar-blues' } });
    fireEvent.change(screen.getByTestId('jam-key'), { target: { value: 'A' } });
    expect(screen.getByTestId('jam-chord-0').textContent).toMatch(/A7 ×4/);
    expect(screen.getByTestId('jam-blurb').textContent).toMatch(/A C D E♭ E G/);
    expect(parsePrefs(localStorage.getItem(PREFS_KEY))).toMatchObject({
      presetId: 'twelve-bar-blues',
      tonic: 'A',
    });
    // A minor preset switches the key list to minor keys.
    fireEvent.change(screen.getByTestId('jam-preset'), { target: { value: 'andalusian' } });
    expect(screen.getByTestId('jam-chord-0').textContent).toMatch(/Am/);
  });
});
