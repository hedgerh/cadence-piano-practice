// decisions.md 2026-10-03 "Minor scales track": the Practice screen names scale steps as
// scales, always shows the step name, and drops the chord-only Show me control and strip.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { practiceSessionFixture } from './dev';
import { initialPracticeState, practiceReducer } from './practiceReducer';
import { eyebrowFor } from './practiceSelectors';
import { PracticeView } from './PracticeView';

// The dev module pulls in the live IPC wiring; nothing here calls it.
vi.mock('../../lib/api', () => ({ api: {}, queryKey: (c: string) => [c] }));

afterEach(cleanup);

function renderScale(hint = 0) {
  const session = practiceSessionFixture({ done: [], vis: 'num', scale: true });
  let state = initialPracticeState(session);
  for (let i = 0; i < hint; i++) state = practiceReducer(state, { type: 'HINT', at: 0 });
  render(
    <MemoryRouter>
      <PracticeView
        state={state}
        title={session.levelTitle}
        eyebrow={eyebrowFor(session)}
        midiStatus={{ kind: 'connected', deviceName: 'Keys', deviceId: 'k' }}
        markPlayed="hidden"
        onHint={() => undefined}
        onSkip={() => undefined}
        onMarkPlayed={() => undefined}
        onVisibility={() => undefined}
        onFinish={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('Practice on a minor-scale level', () => {
  it('reads as scales, with the step name even on numerals-only', () => {
    renderScale();
    expect(screen.getByTestId('practice-count').textContent).toBe('0 of 2 scales');
    expect(screen.getByTestId('chord-no').textContent).toBe('Scale 1 of 2');
    expect(screen.getByTestId('numeral').textContent).toBe('Up');
    expect(screen.getByTestId('chord-name').textContent).toBe('A minor scale, going up');
    expect(screen.queryByTestId('show-me')).toBeNull();
    expect(screen.queryByTestId('practice-strip')).toBeNull();
    expect(screen.getByTestId('keyboard-caption').textContent).toMatch(/One note at a time/);
  });

  it('eyebrow is "Learn · scales"', () => {
    const session = practiceSessionFixture({ done: [], vis: 'all', scale: true });
    expect(eyebrowFor(session).text).toBe('Learn · scales');
  });

  it('hint 1 lists the eight notes in playing order', () => {
    renderScale(1);
    expect(screen.getByText('A minor scale, going up')).toBeTruthy();
    const chips = document.querySelectorAll('[data-testid="note-chips"] > *');
    expect([...chips].map((c) => c.textContent)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A']);
  });
});
