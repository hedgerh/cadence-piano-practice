// decisions.md 2026-10-11 "Interval practice": toggles drive the questions; answers score
// per interval; nothing is recorded (no IPC at all).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import { SynthContext } from '../../audio/useAudio';
import { IntervalPracticePage } from './IntervalPracticePage';
import { SETTINGS_KEY } from './intervalPractice';

// The Sound control reads the profile over IPC; the drill itself never does.
vi.mock('../shared/SoundSetting', () => ({ SoundSetting: () => null }));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function renderPage(route = '/ear-practice/intervals') {
  const synth = new NullSynth();
  render(
    <SynthContext.Provider value={synth}>
      <MemoryRouter initialEntries={[route]}>
        <IntervalPracticePage />
      </MemoryRouter>
    </SynthContext.Provider>,
  );
  return synth;
}

/** Let the auto-play timer fire and the sound's promise settle. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

const pressed = (id: string) => screen.getByTestId(id).getAttribute('aria-pressed');

describe('IntervalPracticePage', () => {
  it('starts on the default set going up and plays the question by itself', async () => {
    const synth = renderPage();
    expect(pressed('practice-interval-P5')).toBe('true');
    expect(pressed('practice-interval-TT')).toBe('false');
    expect(pressed('practice-direction-up')).toBe('true');
    await settle();
    expect(synth.calls.length).toBe(2);
    expect(screen.getAllByTestId(/^practice-answer-/)).toHaveLength(5);
  });

  it('answering shows feedback and counts the interval; Next asks another', async () => {
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('practice-answer-P5'));
    expect(screen.getByTestId('feedback-panel')).toBeTruthy();
    expect(screen.getByTestId('practice-score').textContent).toMatch(/^[01] of 1 right$/);
    fireEvent.click(screen.getByTestId('feedback-next'));
    expect(screen.queryByTestId('feedback-panel')).toBeNull();
  });

  it('?dir=down starts going down; toggles are saved; no intervals → a prompt', async () => {
    renderPage('/ear-practice/intervals?dir=down');
    expect(pressed('practice-direction-down')).toBe('true');
    expect(pressed('practice-direction-up')).toBe('false');
    for (const id of ['P1', 'm3', 'M3', 'P5', 'P8']) {
      fireEvent.click(screen.getByTestId(`practice-interval-${id}`));
    }
    expect(screen.getByTestId('practice-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('practice-interval-TT'));
    await settle();
    expect(screen.getAllByTestId(/^practice-answer-/).map((c) => c.dataset.testid)).toEqual([
      'practice-answer-TT',
    ]);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({
      intervals: ['TT'],
      directions: ['down'],
    });
  });
});
