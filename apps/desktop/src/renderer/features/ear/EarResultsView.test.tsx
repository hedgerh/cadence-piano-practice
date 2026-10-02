import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarResultsView } from './EarResultsView';
import { earCompleteFixture } from './fixtures';

afterEach(cleanup);

function renderResults(complete = earCompleteFixture(true), busy = false) {
  const onAction = vi.fn();
  render(
    <MemoryRouter>
      <EarResultsView complete={complete} onAction={onAction} busy={busy} />
    </MemoryRouter>,
  );
  const buttons = screen.getByTestId('ear-results-card').querySelectorAll('button');
  const labels = Array.from(buttons, (b) => b.textContent);
  return { onAction, labels };
}

// docs/ui.md §3 EarResults · docs/decisions.md "Ear level replay".
describe('EarResultsView actions', () => {
  it('pass with a next level: Keep going, then "Practice Level 3 again", drill, Done', () => {
    const { onAction, labels } = renderResults();
    expect(labels).toEqual([
      'Keep going — Level 4',
      'Practice Level 3 again',
      'Drill what you missed',
      'Done for today',
    ]);
    fireEvent.click(screen.getByTestId('ear-results-practice'));
    expect(onAction).toHaveBeenCalledWith({
      kind: 'practice',
      label: 'Practice Level 3 again',
      levelId: 'intervals-3',
    });
  });

  it('pass with nothing next: primary "Practice Level 3 again", secondary "Back to the map"', () => {
    const { onAction, labels } = renderResults(earCompleteFixture(true, { last: true }));
    expect(labels).toEqual(['Practice Level 3 again', 'Drill what you missed', 'Back to the map']);
    expect(screen.queryByTestId('ear-results-next')).toBeNull();
    fireEvent.click(screen.getByTestId('ear-results-map'));
    expect(onAction).toHaveBeenCalledWith({
      kind: 'map',
      label: 'Back to the map',
      to: '/tracks/ear-training',
    });
  });

  it('fail keeps "Try Level 3 again" and has no practice button', () => {
    const { labels } = renderResults(earCompleteFixture(false));
    expect(labels).toEqual(['Try Level 3 again', 'Drill what you missed', 'Done for today']);
    expect(screen.queryByTestId('ear-results-practice')).toBeNull();
  });

  it('while starting, session actions disable but leaving does not', () => {
    renderResults(earCompleteFixture(true, { last: true }), true);
    expect(screen.getByTestId<HTMLButtonElement>('ear-results-practice').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('ear-results-map').disabled).toBe(false);
  });
});
