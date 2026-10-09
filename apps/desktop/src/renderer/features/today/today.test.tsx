import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectedMidi, midiStatuses } from '../../dev/fixtures/user';
import { fixtureToday, fixtureTodayVariant } from './dev';
import { Onboarding } from './Onboarding';
import {
  blockStates,
  ctaAction,
  ctaNote,
  greetingFor,
  ALL_COMPLETE_SUBTITLE,
  NO_TRACKS_SUBTITLE,
  isJoined,
  partitionTracks,
  resumeOffer,
  resumeProgress,
  todayMode,
  todaySubtitle,
  type TodayDto,
} from './today';
import { TodayView } from './TodayView';

afterEach(cleanup);

describe('greetingFor (Task 07: morning < 12, afternoon < 18, evening otherwise)', () => {
  it.each([
    [0, 'Good morning, Harry.'],
    [11, 'Good morning, Harry.'],
    [12, 'Good afternoon, Harry.'],
    [17, 'Good afternoon, Harry.'],
    [18, 'Good evening, Harry.'],
    [23, 'Good evening, Harry.'],
  ])('hour %i → %s', (hour, want) => {
    expect(greetingFor('Harry', hour)).toBe(want);
  });

  it('drops the name when empty', () => {
    expect(greetingFor('  ', 9)).toBe('Good morning.');
  });
});

describe('blockStates (Main:59/76/91)', () => {
  it('done blocks check, first open is current, the rest upcoming', () => {
    const s = (...st: ('pending' | 'in_progress' | 'done')[]) =>
      blockStates(st.map((status) => ({ status })));
    expect(s('pending', 'pending', 'pending')).toEqual(['current', 'upcoming', 'upcoming']);
    expect(s('done', 'in_progress', 'pending')).toEqual(['done', 'current', 'upcoming']);
    expect(s('done', 'done', 'pending')).toEqual(['done', 'done', 'current']);
    expect(s('done', 'done', 'done')).toEqual(['done', 'done', 'done']);
  });
});

describe('ctaAction (engine.md §4 PlanService step 8)', () => {
  it('starts the first non-done block with its plan block id', () => {
    expect(ctaAction(fixtureToday(1))).toEqual({
      type: 'start',
      input: { levelId: 'a-major', kind: 'learn', planBlockId: 'fixture-1' },
    });
    expect(ctaAction(fixtureToday(0))).toMatchObject({ input: { levelId: 'c-major' } });
  });

  it('routes to the lesson first when lessonFirst', () => {
    const t = fixtureToday(1);
    const today: TodayDto = {
      ...t,
      cta: { ...t.cta, lessonFirst: true },
      blocks: t.blocks.map((b) => ({ ...b, trackId: 'minor-diatonic-chords' })),
    };
    expect(ctaAction(today)).toEqual({
      type: 'navigate',
      to: '/tracks/minor-diatonic-chords/lesson',
    });
  });

  it('follows cta.route when everything is done', () => {
    expect(ctaAction(fixtureToday(3))).toEqual({ type: 'navigate', to: '/tracks' });
  });
});

describe('tracks', () => {
  // decisions.md 2026-10-08 "Track library": Your tracks = joined tracks only.
  it('only joined tracks: circle tracks get cards, ladder tracks rows', () => {
    const { cards, rows } = partitionTracks(fixtureToday(1).tracks);
    expect(cards.map((c) => c.title)).toEqual(['Major diatonic chords']);
    expect(rows.map((c) => c.title)).toEqual(['Ear training']);
  });

  it('isJoined = available, enrolled and active', () => {
    const t = { available: true, enrolled: true, active: true };
    expect(isJoined(t)).toBe(true);
    expect(isJoined({ ...t, active: false })).toBe(false);
    expect(isJoined({ ...t, enrolled: false })).toBe(false);
    expect(isJoined({ ...t, available: false })).toBe(false);
  });

  it('ctaNote follows MIDI and the all-done streak (Main:109, ui.md §3)', () => {
    expect(ctaNote({ allDone: false, streakDays: 8, midi: connectedMidi })).toBe(
      'Your keyboard is listening — just play.',
    );
    expect(ctaNote({ allDone: false, streakDays: 8, midi: midiStatuses['no-device'] })).toMatch(
      /mark each chord/,
    );
    expect(ctaNote({ allDone: true, streakDays: 9, midi: connectedMidi })).toBe(
      'Day 9 streak kept',
    );
  });
});

function renderView(done: number, onCta = vi.fn()) {
  render(
    <MemoryRouter>
      <TodayView
        greeting="Good evening, Harry."
        streakDays={8}
        xp={1240}
        today={fixtureToday(done)}
        midi={connectedMidi}
        midiOverride={connectedMidi}
        onCta={onCta}
      />
    </MemoryRouter>,
  );
  return onCta;
}

describe('TodayView states (ui.md §3: 0/1/2/3 done)', () => {
  it('done=1 reproduces Main.dc.html', () => {
    const onCta = renderView(1);
    expect(screen.getByTestId('today-greeting').textContent).toBe('Good evening, Harry.');
    const rows = screen.getAllByTestId('block-row');
    expect(rows.map((r) => r.dataset.state)).toEqual(['done', 'current', 'upcoming']);
    expect(rows[0]?.textContent).toContain('2 min · done');
    expect(rows[1]?.textContent).toContain('5 min · up next');
    expect(screen.getByTestId('today-cta').textContent).toBe('Continue with A major');
    fireEvent.click(screen.getByTestId('today-cta'));
    expect(onCta).toHaveBeenCalledOnce();
    expect(screen.getByTestId('track-card-major-diatonic-chords').getAttribute('href')).toBe(
      '/tracks/major-diatonic-chords',
    );
    expect(screen.getByTestId('track-row-ear-training').textContent).toContain(
      'Intervals · Level 3',
    );
    expect(screen.queryByTestId('track-card-minor-diatonic-chords')).toBeNull();
    expect(screen.getByTestId('all-tracks').getAttribute('href')).toBe('/tracks');
    expect(screen.getByTestId('add-track').getAttribute('href')).toBe('/tracks');
  });

  it('done=0 starts the warm-up', () => {
    renderView(0);
    expect(screen.getAllByTestId('block-row').map((r) => r.dataset.state)).toEqual([
      'current',
      'upcoming',
      'upcoming',
    ]);
    expect(screen.getByTestId('today-cta').textContent).toBe('Start C major');
  });

  it('done=2 makes the review current', () => {
    renderView(2);
    expect(screen.getAllByTestId('block-row').map((r) => r.dataset.state)).toEqual([
      'done',
      'done',
      'current',
    ]);
    expect(screen.getByTestId('today-cta').textContent).toBe('Start G major');
  });

  it('done=3 shows the all-done variant', () => {
    renderView(3);
    expect(screen.queryByTestId('today-cta')).toBeNull();
    expect(screen.getByTestId('today-extra').textContent).toBe('Practice something extra');
    expect(screen.getByTestId('today-cta-note').textContent).toBe('Day 8 streak kept');
    expect(screen.getByText('Come back tomorrow to keep the streak.')).toBeTruthy();
  });
});

describe('Onboarding', () => {
  it('submits the trimmed name; disabled while empty', () => {
    const onSubmit = vi.fn();
    render(<Onboarding onSubmit={onSubmit} />);
    const button = screen.getByTestId('onboarding-submit');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('onboarding-name'), { target: { value: '  Harry ' } });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith('Harry');
  });
});

// Task 16 edge states.
describe('Today edge states (Task 16)', () => {
  it('todayMode: no active tracks / every active track complete / a plan', () => {
    expect(todayMode(fixtureToday(1))).toBe('plan');
    expect(todayMode(fixtureTodayVariant(1, { state: 'no-tracks' }))).toBe('no-tracks');
    expect(todayMode(fixtureTodayVariant(1, { state: 'all-complete' }))).toBe('all-complete');
  });

  it('subtitles: no tracks, all complete with nothing planned, otherwise the engine copy', () => {
    expect(todaySubtitle(fixtureTodayVariant(1, { state: 'no-tracks' }))).toBe(NO_TRACKS_SUBTITLE);
    const complete = fixtureTodayVariant(1, { state: 'all-complete' });
    expect(todaySubtitle({ ...complete, blocks: [] })).toBe(ALL_COMPLETE_SUBTITLE);
    expect(todaySubtitle(complete)).toBe(complete.subtitle);
    expect(todaySubtitle(fixtureToday(3))).toBe('Come back tomorrow to keep the streak.');
  });

  it('resumeOffer hides the row when the CTA already continues that level', () => {
    const t = fixtureTodayVariant(1, { resume: true });
    expect(resumeOffer(t)?.levelId).toBe('intervals-3');
    expect(resumeOffer({ ...t, cta: { ...t.cta, levelId: 'intervals-3' } })).toBeNull();
    expect(resumeOffer(fixtureToday(1))).toBeNull();
    expect(resumeProgress({ done: 3, total: 7, isEar: false, stepNoun: 'chord' })).toBe(
      '3 of 7 chords played',
    );
    expect(resumeProgress({ done: 1, total: 2, isEar: false, stepNoun: 'scale' })).toBe(
      '1 of 2 scales played',
    );
    expect(resumeProgress({ done: 4, total: 10, isEar: true, stepNoun: 'step' })).toBe(
      '4 of 10 answered',
    );
  });

  function renderToday(today: TodayDto) {
    render(
      <MemoryRouter>
        <TodayView
          greeting="Good evening, Harry."
          streakDays={8}
          xp={1240}
          today={today}
          midi={connectedMidi}
          midiOverride={connectedMidi}
          onCta={() => undefined}
        />
      </MemoryRouter>,
    );
  }

  it('renders "Resume Intervals · Level 3" linking to the session route', () => {
    renderToday(fixtureTodayVariant(1, { resume: true }));
    const row = screen.getByTestId('today-resume');
    expect(row.textContent).toContain('Left mid-way4 of 10 answered');
    const link = screen.getByTestId('today-resume-link');
    expect(link.textContent).toBe('Resume Intervals · Level 3');
    expect(link.getAttribute('href')).toBe('/ear/intervals-3?session=fixture-session');
  });

  it('no active tracks: no plan card, and the CTA opens the track library', () => {
    renderToday(fixtureTodayVariant(1, { state: 'no-tracks' }));
    expect(screen.queryByTestId('today-plan')).toBeNull();
    expect(screen.queryByTestId('today-cta-note')).toBeNull();
    const cta = screen.getByTestId('today-cta');
    expect(cta.textContent).toContain('Pick something to learn');
    expect(cta.getAttribute('href')).toBe('/tracks');
  });
});
