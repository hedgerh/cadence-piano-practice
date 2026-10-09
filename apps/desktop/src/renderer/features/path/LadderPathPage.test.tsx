import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_TRACKS, fixtureLadderOverview } from '../earpath/dev';
import {
  HOW_A_LEVEL_WORKS,
  levelSegment,
  replayLevels,
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

  it('trackPills: the Ear training group only, active (decisions.md 2026-10-08)', () => {
    expect(trackPills(FIXTURE_TRACKS, 'ear-training').map((p) => [p.id, p.state])).toEqual([
      ['ear-training', 'active'],
    ]);
  });
});

// docs/decisions.md "Ear level replay".
describe('replayLevels (which levels can be replayed)', () => {
  it('open stage: only the passed levels, with content blurbs and segment names', () => {
    const intervals = fixtureLadderOverview().stages?.[0];
    expect(intervals && replayLevels(intervals)).toEqual([
      {
        levelId: 'intervals-1',
        index: 0,
        label: 'Level 1 · Unison, perfect 5th and octave, going up from C',
        ariaLabel: 'Replay Level 1',
      },
      {
        levelId: 'intervals-2',
        index: 1,
        label: 'Level 2 · Adds the major and minor 3rd to unison, 5th and octave',
        ariaLabel: 'Replay Level 2',
      },
    ]);
  });

  it('complete stages replay every level; locked and untouched stages offer none', () => {
    const stages = fixtureLadderOverview('all', true).stages ?? [];
    expect(stages.map((s) => replayLevels(s).map((l) => l.levelId))).toEqual([
      ['intervals-1', 'intervals-2', 'intervals-3', 'intervals-4', 'intervals-5', 'intervals-6'],
      [],
      [],
      [],
      [],
    ]);
    const locked = stages[3];
    // Even a (malformed) done level in a locked stage is not offered.
    expect(
      locked &&
        replayLevels({
          ...locked,
          levels: locked.levels.map((l) => ({ ...l, state: 'done' as const })),
        }),
    ).toEqual([]);
  });

  it('a level without a blurb is labelled by its title', () => {
    const intervals = fixtureLadderOverview().stages?.[0];
    const bare = intervals && {
      ...intervals,
      levels: intervals.levels.map((l) => ({ ...l, blurb: '' })),
    };
    expect(bare && replayLevels(bare)[0]?.label).toBe('Level 1');
  });
});

describe('LadderPathView', () => {
  function renderView(overrides: Partial<Parameters<typeof LadderPathView>[0]> = {}) {
    const onStart = vi.fn();
    const onReplay = vi.fn();
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
          onReplay={onReplay}
          onVisibility={onVisibility}
          {...overrides}
        />
      </MemoryRouter>,
    );
    return { onStart, onReplay, onVisibility };
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

  it('passed segments are replay buttons; the current and later levels are not', () => {
    const { onReplay, onStart } = renderView();
    const current = screen.getAllByTestId('stage-row')[0];
    if (!current) throw new Error('no stage row');
    const buttons = within(current).getAllByRole('button', { name: /^Replay Level/ });
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Replay Level 1',
      'Replay Level 2',
    ]);
    expect(current.querySelectorAll('span[data-state]')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Replay Level 2' }));
    expect(onReplay).toHaveBeenCalledWith('intervals-2');
    expect(onStart).not.toHaveBeenCalled();
    // The card still links to the up-next level, without wrapping the buttons in an <a>.
    expect(within(current).getByRole('link').getAttribute('href')).toBe('/ear/intervals-3');
    expect(current.querySelector('a button')).toBeNull();
    expect(screen.getByTestId('ladder-start').textContent).toBe('Start Level 3');
  });

  it('"Replay a level" toggles a list of the passed levels; locked stages have none', () => {
    const { onReplay } = renderView();
    expect(screen.getAllByRole('button', { name: 'Replay a level' })).toHaveLength(1);
    const toggle = screen.getByTestId('replay-toggle-intervals');
    expect(screen.queryByTestId('replay-list-intervals')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const list = within(screen.getByTestId('replay-list-intervals'));
    expect(list.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Level 1 · Unison, perfect 5th and octave, going up from C',
      'Level 2 · Adds the major and minor 3rd to unison, 5th and octave',
    ]);
    fireEvent.click(screen.getByTestId('replay-level-intervals-1'));
    expect(onReplay).toHaveBeenCalledWith('intervals-1');
    fireEvent.click(toggle);
    expect(screen.queryByTestId('replay-list-intervals')).toBeNull();
  });

  it('a complete stage gets the same affordance; busy disables the replay buttons', () => {
    renderView({
      overview: fixtureLadderOverview('all', true),
      initialReplayStage: 'intervals',
      starting: true,
    });
    const list = within(screen.getByTestId('replay-list-intervals'));
    expect(list.getAllByRole('button')).toHaveLength(6);
    for (const b of list.getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true);
    // Scale degrees is open but nothing is passed yet: no toggle.
    expect(screen.queryByTestId('replay-toggle-scale-degrees')).toBeNull();
  });

  it('while the overview loads only the header and pills render', () => {
    renderView({ overview: undefined });
    expect(screen.getByTestId('app-header')).toBeTruthy();
    expect(screen.getByTestId('track-pills')).toBeTruthy();
    expect(screen.queryByTestId('stage-row')).toBeNull();
  });
});
