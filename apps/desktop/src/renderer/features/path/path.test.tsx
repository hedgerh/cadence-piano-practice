import { majorDiatonicChords, minorDiatonicChords } from '@cadence/content';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackOverviewDto } from '../shared/hooks';
import { minorReadyOverview } from './dev';
import {
  circleKeys,
  circleRunStart,
  ctaLabel,
  finishedKeys,
  innerRing,
  isCompactLabel,
  planBlockFor,
  primaryAction,
  trackEyebrow,
  trackPattern,
  trackPills,
  upNextCard,
} from './path';
import { PathView } from './PathView';
import { ReviewFinishedKey } from './ReviewFinishedKey';

afterEach(cleanup);

/** The major track on seed day8 (engine.md §4.T): C, G, D done, A current. */
function majorDay8(): TrackOverviewDto {
  const track = majorDiatonicChords();
  const levels = track.levels ?? [];
  const labels = ['C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  return {
    trackId: track.id,
    title: track.title,
    blurb: track.blurb,
    map: track.map,
    available: true,
    enrolled: true,
    active: true,
    visibility: 'all',
    hasLesson: false,
    lessonSeen: false,
    progress: { done: 3, total: 12, label: '3 of 12 keys' },
    completedTitles: 'C, G, D',
    nodes: levels.map((l, i) => ({
      levelId: l.id,
      title: l.title,
      label: labels[i] ?? '',
      state: i < 3 ? 'done' : i === 3 ? 'current' : 'upcoming',
      mastered: false,
      dueCount: 0,
    })),
    stages: null,
    upNext: {
      levelId: 'a-major',
      title: 'A major',
      stageTitle: null,
      blurb: 'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°',
      label: 'Start A major',
      route: '/practice/a-major',
    },
  };
}

describe('trackPills (Path:41–47)', () => {
  it('active ink pill, available links, locked spans for available:false', () => {
    const pills = trackPills(
      [
        { id: 'a', title: 'A', map: 'circle-of-fifths', available: true },
        { id: 'b', title: 'B', map: 'circle-of-fifths', available: true },
        { id: 'c', title: 'C', map: 'circle-of-fifths', available: false },
      ],
      'b',
    );
    expect(pills.map((p) => [p.id, p.state, p.to])).toEqual([
      ['a', 'available', '/tracks/a'],
      ['b', 'active', '/tracks/b'],
      ['c', 'locked', '/tracks/c'],
    ]);
  });
});

describe('circle content (Path:93–129; minor track: outer minors, inner relative majors)', () => {
  it('major track inner ring = the design relative minors', () => {
    const ring = innerRing(majorDiatonicChords());
    expect(ring.labels).toEqual([
      'Am',
      'Em',
      'Bm',
      'F#m',
      'C#m',
      'G#m',
      'Ebm',
      'Bbm',
      'Fm',
      'Cm',
      'Gm',
      'Dm',
    ]);
    expect(ring.caption).toBe('inner ring: relative minors');
  });

  it('minor track inner ring = relative majors', () => {
    const ring = innerRing(minorDiatonicChords());
    expect(ring.labels).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F']);
    expect(ring.caption).toBe('inner ring: relative majors');
  });

  it('pattern card comes from the first level (Path:60–74)', () => {
    expect(trackPattern(majorDiatonicChords())).toEqual({
      title: 'The pattern in every major key',
      chips: [
        { numeral: 'I', quality: 'major' },
        { numeral: 'ii', quality: 'minor' },
        { numeral: 'iii', quality: 'minor' },
        { numeral: 'IV', quality: 'major' },
        { numeral: 'V', quality: 'major' },
        { numeral: 'vi', quality: 'minor' },
        { numeral: 'vii°', quality: 'diminished' },
      ],
    });
    const minor = trackPattern(minorDiatonicChords());
    expect(minor?.title).toBe('The pattern in every minor key');
    expect(minor?.chips.map((c) => c.numeral).join(' ')).toBe('i ii° III iv v VI VII');
  });

  it('compact labels: slot 6 (Path:110 G♭ at 20px) and three-character labels', () => {
    expect(isCompactLabel('G♭', 6)).toBe(true);
    expect(isCompactLabel('D♭', 7)).toBe(false);
    expect(isCompactLabel('F♯m', 3)).toBe(true);
    expect(isCompactLabel('Am', 0)).toBe(false);
  });

  it('done nodes review their level, current runs the CTA, upcoming is inert', () => {
    const onDone = vi.fn();
    const onCurrent = vi.fn();
    const keys = circleKeys(majorDay8(), { onDone, onCurrent });
    expect(keys.map((k) => k.state).slice(0, 5)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
    ]);
    keys[1]?.onClick?.();
    expect(onDone).toHaveBeenCalledWith('g-major');
    keys[3]?.onClick?.();
    expect(onCurrent).toHaveBeenCalledTimes(1);
    expect(keys[4]?.onClick).toBeUndefined();
    expect(keys[6]?.compact).toBe(true);
    expect(finishedKeys(majorDay8()).map((k) => k.title)).toEqual([
      'C major',
      'G major',
      'D major',
    ]);
  });
});

describe('primary action and up-next card (engine.md §4 lesson-seen, §6.15 enrolment)', () => {
  it('day8 major: Up next A major, start a learn session', () => {
    const o = majorDay8();
    expect(trackEyebrow(o)).toBe('Track · 3 of 12 keys');
    expect(upNextCard(o)).toEqual({
      eyebrow: 'Up next',
      title: 'A major',
      body: 'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°',
      note: null,
    });
    expect(ctaLabel(o)).toBe('Start A major');
    expect(primaryAction(o)).toEqual({ type: 'start', enroll: false, levelId: 'a-major' });
  });

  it('minor track not enrolled: Ready to start → enroll, then the lesson', () => {
    const o = minorReadyOverview();
    expect(upNextCard(o)).toMatchObject({
      eyebrow: 'Ready to start',
      title: 'A minor',
      note: 'Starts with a 1-min lesson',
    });
    expect(ctaLabel(o)).toBe('Start with the lesson');
    expect(primaryAction(o)).toEqual({ type: 'lesson', enroll: true });
  });

  it('enrolled minor track: lesson once, then straight to practice', () => {
    const enrolled = { ...minorReadyOverview(), enrolled: true, active: true };
    expect(primaryAction(enrolled)).toEqual({ type: 'lesson', enroll: false });
    expect(upNextCard(enrolled).eyebrow).toBe('Up next');
    const seen = { ...enrolled, lessonSeen: true };
    expect(primaryAction(seen)).toEqual({ type: 'start', enroll: false, levelId: 'a-minor' });
    expect(ctaLabel(seen)).toBe('Start A minor');
    expect(upNextCard(seen).note).toBeNull();
  });

  it('paused track re-activates; complete track has no CTA', () => {
    const paused = { ...majorDay8(), active: false };
    expect(primaryAction(paused)).toEqual({ type: 'start', enroll: true, levelId: 'a-major' });
    const complete = { ...majorDay8(), upNext: null };
    expect(primaryAction(complete)).toEqual({ type: 'none' });
    expect(ctaLabel(complete)).toBeNull();
    expect(upNextCard(complete).eyebrow).toBe('Complete');
  });

  it('planBlockFor picks the open block for the level and kind', () => {
    const blocks = [
      { id: 'w', levelId: 'c-major', kind: 'warmup', status: 'done' },
      { id: 'l', levelId: 'a-major', kind: 'learn', status: 'pending' },
      { id: 'r', levelId: 'g-major', kind: 'review', status: 'pending' },
    ];
    expect(planBlockFor(blocks, 'a-major', 'learn')).toBe('l');
    expect(planBlockFor(blocks, 'g-major', 'review')).toBe('r');
    expect(planBlockFor(blocks, 'c-major', 'warmup')).toBeUndefined();
    expect(planBlockFor(undefined, 'a-major', 'learn')).toBeUndefined();
  });
});

describe('PathView', () => {
  function renderPath(
    onCta = vi.fn(),
    onDone = vi.fn(),
    reviewOpen = false,
    onPlayCircle: (() => void) | undefined = undefined,
  ) {
    const o = majorDay8();
    const ring = innerRing(majorDiatonicChords());
    render(
      <MemoryRouter>
        <PathView
          streakDays={8}
          xp={1240}
          pills={trackPills(
            [
              {
                id: 'major-diatonic-chords',
                title: 'Major diatonic chords',
                map: 'circle-of-fifths',
                available: true,
              },
            ],
            'major-diatonic-chords',
          )}
          eyebrow={trackEyebrow(o)}
          title={o.title}
          blurb={o.blurb}
          pattern={trackPattern(majorDiatonicChords())}
          upNext={upNextCard(o)}
          ctaLabel={ctaLabel(o)}
          onCta={onCta}
          canReview
          reviewOpen={reviewOpen}
          onToggleReview={() => undefined}
          review={<ReviewFinishedKey keys={finishedKeys(o)} onPick={onDone} />}
          onPlayCircle={onPlayCircle}
          circle={{
            keys: circleKeys(o, { onCurrent: onCta, onDone }),
            minors: ring.labels,
            complete: 3,
            total: 12,
            innerLabel: ring.caption,
          }}
        />
      </MemoryRouter>,
    );
  }

  it('renders the up-next copy, pattern and a clickable circle', () => {
    const onCta = vi.fn();
    const onDone = vi.fn();
    renderPath(onCta, onDone);
    expect(screen.getByTestId('up-next-body').textContent).toBe(
      'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°',
    );
    expect(screen.getByTestId('path-cta').textContent).toBe('Start A major');
    expect(screen.getAllByTestId(/^pattern-chip-/)).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'C major, complete — review it' }));
    expect(onDone).toHaveBeenCalledWith('c-major');
    fireEvent.click(screen.getByRole('button', { name: 'A major, up next' }));
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(screen.getByText('inner ring: relative minors')).toBeTruthy();
    expect(screen.queryByTestId('review-finished')).toBeNull();
  });

  it('the review card lists done keys and starts a review', () => {
    const onDone = vi.fn();
    renderPath(vi.fn(), onDone, true);
    const card = screen.getByTestId('review-finished');
    expect(card.textContent).toContain('C major');
    fireEvent.click(screen.getByTestId('review-key-d-major'));
    expect(onDone).toHaveBeenCalledWith('d-major');
  });

  it('"Play the whole circle" sits next to "Review a finished key" when a handler is given', () => {
    renderPath();
    expect(screen.queryByTestId('circle-run')).toBeNull();
    cleanup();
    const onPlayCircle = vi.fn();
    renderPath(vi.fn(), vi.fn(), false, onPlayCircle);
    const button = screen.getByTestId('circle-run');
    expect(button.textContent).toBe('Play the whole circle');
    expect(button.previousElementSibling?.textContent).toBe('Review a finished key');
    fireEvent.click(button);
    expect(onPlayCircle).toHaveBeenCalledTimes(1);
  });
});

// decisions.md 2026-10-03 circle run.
describe('circleRunStart', () => {
  it('starts at the first key in circle order once any key is done', () => {
    expect(circleRunStart(majorDay8())).toEqual({
      levelId: 'c-major',
      kind: 'review',
      enroll: false,
    });
    const paused = { ...majorDay8(), active: false };
    expect(circleRunStart(paused)?.enroll).toBe(true);
  });

  it('is unavailable before the first key is done and on ladder tracks', () => {
    const fresh = majorDay8();
    const nodes = (fresh.nodes ?? []).map((n) => ({ ...n, state: 'upcoming' as const }));
    expect(circleRunStart({ ...fresh, nodes })).toBeNull();
    expect(circleRunStart({ ...fresh, nodes: null })).toBeNull();
  });
});
