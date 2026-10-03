import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chipView, completeView, formatDuration } from './complete';
import { CompleteView } from './CompleteView';
import { circleRunFixture, completeDtoFixture, parseSkipped } from './dev';

afterEach(cleanup);

describe('formatDuration (engine.md §6.7: shown m:ss)', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [5_000, '0:05'],
    [59_999, '0:59'],
    [60_000, '1:00'],
    [134_000, '2:14'], // Complete:50
    [134_999, '2:14'],
    [600_000, '10:00'],
    [3_725_000, '62:05'],
    [-1, '0:00'],
    [Number.NaN, '0:00'],
  ])('%d ms → %s', (ms, want) => {
    expect(formatDuration(ms)).toBe(want);
  });
});

describe('chipView (Complete:39–45, ui.md §3 skipped chips dashed)', () => {
  const base = { ordinal: 6, stepId: 'd7', label: 'vii°', short: 'G♯°', quality: null } as const;
  it.each([
    ['clean', 'G♯°', 'done'],
    ['hinted', 'G♯° · hint', 'hinted'],
    ['skipped', 'G♯° · skipped', 'skipped'],
    ['marked', 'G♯° · marked', 'done'],
    ['wrong', 'G♯°', 'skipped'],
  ] as const)('%s → %s (%s)', (result, sub, state) => {
    expect(chipView({ ...base, result })).toMatchObject({ numeral: 'vii°', sub, state });
  });
});

describe('completeView', () => {
  it('reproduces Complete.dc.html for the design fixture', () => {
    const v = completeView(completeDtoFixture());
    expect(v.title).toBe('A major, complete');
    expect(v.subtitle).toBe("All seven diatonic chords. That's four keys around the circle.");
    expect(v.chips.map((c) => [c.numeral, c.sub, c.state])).toEqual([
      ['I', 'A', 'done'],
      ['ii', 'Bm', 'done'],
      ['iii', 'C♯m', 'done'],
      ['IV', 'D', 'done'],
      ['V', 'E', 'done'],
      ['vi', 'F♯m', 'done'],
      ['vii°', 'G♯° · hint', 'hinted'],
    ]);
    expect(v.stats).toEqual([
      { value: '2:14', label: 'time, no tempo', tone: 'ground' },
      { value: '6 of 7', label: 'chords without a hint', tone: 'ground' },
      { value: '+40 XP', label: 'day 8 streak kept', tone: 'lavender' },
    ]);
    expect(v.progressLeft).toBe('Major diatonic chords · 4 of 12 keys');
    expect(v.progressRight).toBe('Next on the circle: E major');
    expect(v.progress).toBeCloseTo(0.333, 3);
    expect(v.reviewNote).toBe("G♯° will come back in tomorrow's review until it's clean.");
    expect(v.primary).toEqual({
      kind: 'next',
      label: 'Keep going — E major',
      levelId: 'e-major',
      run: null,
    });
    expect(v.runCaption).toBeNull();
    expect(v.secondary).toEqual({ kind: 'done', label: 'Done for today' });
    expect(v.tertiary).toBeNull();
  });

  it('skipped variant: adjusted copy, replay primary, "Keep going" demoted (ui.md §3)', () => {
    const v = completeView(completeDtoFixture([1, 4]));
    expect(v.skipped).toBe(2);
    expect(v.subtitle).toBe(
      "Five of seven played, two skipped for now. That's four keys around the circle.",
    );
    expect(v.chips.filter((c) => c.state === 'skipped').map((c) => c.sub)).toEqual([
      'Bm · skipped',
      'E · skipped',
    ]);
    expect(v.stats[1]?.value).toBe('4 of 7');
    expect(v.reviewNote).toBe('Bm, E and G♯° come back tomorrow.');
    expect(v.primary).toEqual({ kind: 'replay', label: 'Play the two you skipped' });
    expect(v.secondary).toEqual({
      kind: 'next',
      label: 'Keep going — E major',
      levelId: 'e-major',
      run: null,
    });
    expect(v.tertiary).toEqual({ kind: 'done', label: 'Done for today' });
    expect(completeView(completeDtoFixture([2])).primary.label).toBe('Play the one you skipped');
  });

  it('nothing next on the circle: "Done for today" is the only action', () => {
    const dto = completeDtoFixture();
    const v = completeView({
      ...dto,
      next: null,
      track: { ...dto.track, done: 12, nextLevelId: null, nextTitle: null },
    });
    expect(v.primary).toEqual({ kind: 'done', label: 'Done for today' });
    expect(v.secondary).toBeNull();
    expect(v.progressRight).toBeNull();
    expect(v.progress).toBe(1);
  });

  it('parses the ?skipped= knob', () => {
    expect(parseSkipped('1,4')).toEqual([1, 4]);
    expect(parseSkipped(' 2 , x, 9, -1')).toEqual([2]);
    expect(parseSkipped(null)).toEqual([]);
  });
});

describe('CompleteView', () => {
  it('renders the design and routes the actions', () => {
    const onAction = vi.fn();
    render(
      <MemoryRouter>
        <CompleteView complete={completeDtoFixture()} onAction={onAction} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('A major, complete');
    expect(screen.getAllByTestId('stat-tile').map((t) => t.textContent)).toEqual([
      '2:14time, no tempo',
      '6 of 7chords without a hint',
      '+40 XPday 8 streak kept',
    ]);
    expect(screen.getByTestId('complete-chip-6').dataset['state']).toBe('hinted');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('33.3');
    fireEvent.click(screen.getByTestId('complete-next'));
    expect(onAction).toHaveBeenLastCalledWith({
      kind: 'next',
      label: 'Keep going — E major',
      levelId: 'e-major',
      run: null,
    });
    expect(screen.queryByTestId('complete-run')).toBeNull();
    fireEvent.click(screen.getByTestId('complete-done'));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'done', label: 'Done for today' });
  });

  it('disables the session buttons while a start is in flight', () => {
    render(
      <MemoryRouter>
        <CompleteView complete={completeDtoFixture([1, 4])} onAction={() => undefined} busy />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('complete-replay').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('complete-next').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('complete-done').hasAttribute('disabled')).toBe(false);
  });
});

// decisions.md 2026-10-03 circle run.
describe('circle run', () => {
  const NEXT_RUN = {
    kind: 'next',
    label: 'Keep going — E major',
    levelId: 'e-major',
    run: 'circle',
  } as const;

  it('mid-run: "Circle run · 4 of 12" caption; "Keep going" carries the run', () => {
    const v = completeView(circleRunFixture('mid'));
    expect(v.runCaption).toBe('Circle run · 4 of 12');
    expect(v.primary).toEqual(NEXT_RUN);
    expect(v.secondary).toEqual({ kind: 'done', label: 'Done for today' });
    expect(v.autoNext).toEqual({ action: NEXT_RUN, title: 'E major' });
    expect(v.subtitle).toBe("All seven diatonic chords. That's four keys around the circle.");
  });

  it('skipped mid-run: no auto-continue; the demoted "Keep going" still carries the run', () => {
    const v = completeView(circleRunFixture('mid', [1]));
    expect(v.primary).toEqual({ kind: 'replay', label: 'Play the one you skipped' });
    expect(v.secondary).toEqual(NEXT_RUN);
    expect(v.autoNext).toBeNull();
  });

  it('end of the run: "That’s the whole circle." with "Back to the map" / "Done for today"', () => {
    const v = completeView(circleRunFixture('end'));
    expect(v.runCaption).toBe('Circle run · 12 of 12');
    expect(v.subtitle).toBe("All seven diatonic chords. That's the whole circle.");
    expect(v.primary).toEqual({ kind: 'map', label: 'Back to the map' });
    expect(v.secondary).toEqual({ kind: 'done', label: 'Done for today' });
    expect(v.tertiary).toBeNull();
    expect(v.autoNext).toBeNull();
    const skipped = completeView(circleRunFixture('end', [2]));
    expect(skipped.subtitle).toBe(
      "Six of seven played, one skipped for now. That's the whole circle.",
    );
    expect(skipped.secondary).toEqual({ kind: 'map', label: 'Back to the map' });
    expect(skipped.tertiary).toEqual({ kind: 'done', label: 'Done for today' });
  });

  it('renders the caption and routes the run actions', () => {
    const onAction = vi.fn();
    const r = render(
      <MemoryRouter>
        <CompleteView complete={circleRunFixture('mid')} onAction={onAction} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('complete-run').textContent).toBe('Circle run · 4 of 12');
    fireEvent.click(screen.getByTestId('complete-next'));
    expect(onAction).toHaveBeenLastCalledWith(NEXT_RUN);
    r.rerender(
      <MemoryRouter>
        <CompleteView complete={circleRunFixture('end')} onAction={onAction} busy />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('complete-run').textContent).toBe('Circle run · 12 of 12');
    expect(screen.getByTestId('complete-subtitle').textContent).toContain(
      "That's the whole circle.",
    );
    expect(screen.queryByTestId('complete-hands-free')).toBeNull();
    expect(screen.getByTestId('complete-map').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('complete-map'));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'map', label: 'Back to the map' });
  });
});
