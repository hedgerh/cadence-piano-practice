import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_TRACKS, fixtureLadderOverview } from '../earpath/dev';
import {
  HOW_A_LEVEL_WORKS,
  levelSegment,
  stageEyebrow,
  stageRows,
  trackPills,
  upNextTitle,
} from './LadderModel';
import { LadderPathView } from './LadderPathView';

afterEach(cleanup);

describe('stageRows (engine.md §4 trackOverview ladder → EarPath:82–157)', () => {
  it('maps open/locked stages to current/locked rows with engine copy', () => {
    const rows = stageRows(fixtureLadderOverview());
    expect(rows.map((r) => [r.index, r.state, r.title, r.meta])).toEqual([
      [1, 'current', 'Intervals', 'Level 3 of 6'],
      [2, 'locked', 'Scale degrees', 'Unlocks at Intervals L4'],
      [3, 'locked', 'Chord quality', 'Unlocks at Intervals L5'],
      [4, 'locked', 'Chords in a key', 'Unlocks after Scale degrees L3'],
      [5, 'locked', 'Find the key', 'Unlocks after Chords in a key L2'],
    ]);
    expect(rows[0]?.levels).toEqual(['done', 'done', 'current', 'empty', 'empty', 'empty']);
    expect(rows[0]?.to).toBe('/ear/intervals-3');
    expect(rows[1]?.levels).toBeUndefined();
    expect(rows.map((r) => r.last)).toEqual([false, false, false, false, true]);
  });

  it('complete stages render done with "Complete"; only the up-next stage links', () => {
    const rows = stageRows(fixtureLadderOverview('all', true));
    expect(rows.map((r) => [r.state, r.meta])).toEqual([
      ['done', 'Complete'],
      ['current', 'Level 1 of 4'],
      ['current', 'Level 1 of 3'],
      ['locked', 'Unlocks at Scale degrees L4'],
      ['locked', 'Unlocks after Chords in a key L2'],
    ]);
    expect(rows.map((r) => r.to)).toEqual([
      undefined,
      '/ear/scale-degrees-1',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('renders whatever stages the engine sends (no hardcoded list)', () => {
    const o = fixtureLadderOverview();
    const two = { ...o, stages: (o.stages ?? []).slice(0, 2) };
    expect(stageRows(two).map((r) => r.title)).toEqual(['Intervals', 'Scale degrees']);
    expect(stageRows({ ...o, stages: null })).toEqual([]);
  });
});

describe('ladder helpers', () => {
  it('levelSegment: done teal · current tangerine · upcoming/locked empty', () => {
    expect(['done', 'current', 'upcoming', 'locked'].map((s) => levelSegment(s as never))).toEqual([
      'done',
      'current',
      'empty',
      'empty',
    ]);
  });

  it('stageEyebrow follows up-next (EarPath:53)', () => {
    expect(stageEyebrow(fixtureLadderOverview())).toBe('Track · stage 1 of 5');
    expect(stageEyebrow(fixtureLadderOverview('all', true))).toBe('Track · stage 2 of 5');
  });

  it('upNextTitle joins stage and level (EarPath:70)', () => {
    const upNext = fixtureLadderOverview().upNext;
    expect(upNext && upNextTitle(upNext)).toBe('Intervals · Level 3');
    expect(upNext && upNextTitle({ ...upNext, stageTitle: null })).toBe('Level 3');
  });

  it('trackPills: active / available / locked (Path:42–46)', () => {
    expect(trackPills(FIXTURE_TRACKS, 'ear-training').map((p) => p.state)).toEqual([
      'available',
      'available',
      'locked',
      'locked',
      'active',
    ]);
  });
});

describe('LadderPathView', () => {
  function renderView(overrides: Partial<Parameters<typeof LadderPathView>[0]> = {}) {
    const onStart = vi.fn();
    const onVisibility = vi.fn();
    render(
      <MemoryRouter>
        <LadderPathView
          streakDays={8}
          xp={1240}
          tracks={FIXTURE_TRACKS}
          overview={fixtureLadderOverview()}
          trackId="ear-training"
          onStart={onStart}
          onVisibility={onVisibility}
          {...overrides}
        />
      </MemoryRouter>,
    );
    return { onStart, onVisibility };
  }

  it('renders the design copy and starts the up-next level', () => {
    const { onStart } = renderView();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ear training');
    expect(screen.getByTestId('ladder-eyebrow').textContent).toBe('Track · stage 1 of 5');
    const how = within(screen.getByTestId('ladder-how'));
    for (const line of HOW_A_LEVEL_WORKS) expect(how.getByText(line)).toBeTruthy();
    expect(screen.getByTestId('ladder-up-next').textContent).toContain('Intervals · Level 3');
    expect(screen.getAllByTestId('stage-row')).toHaveLength(5);
    fireEvent.click(screen.getByTestId('ladder-start'));
    expect(onStart).toHaveBeenCalledWith('intervals-3');
  });

  it('Show me sets the track visibility', () => {
    const { onVisibility } = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Numerals only' }));
    expect(onVisibility).toHaveBeenCalledWith('num');
  });

  it('while the overview loads only the header and pills render', () => {
    renderView({ overview: undefined });
    expect(screen.getByTestId('app-header')).toBeTruthy();
    expect(screen.getByTestId('track-pills')).toBeTruthy();
    expect(screen.queryByTestId('stage-row')).toBeNull();
  });
});
