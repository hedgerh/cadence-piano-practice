// decisions.md 2026-10-08 "Track library": every track, grouped by content `group`, as cards.
import { buildTracks } from '@cadence/content';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { libraryFixture } from './dev';
import { libraryCard, librarySections, type TrackCardDto } from './library';
import { LibraryView } from './LibraryView';

afterEach(cleanup);

const byId = (id: string): TrackCardDto => {
  const t = libraryFixture().find((c) => c.trackId === id);
  if (!t) throw new Error(id);
  return t;
};

/** Every content track is available today, so "coming soon" is tested with a made-up one. */
const comingSoon: TrackCardDto = {
  ...byId('bass-and-chords'),
  trackId: 'modes',
  title: 'Modes',
  available: false,
};

describe('librarySections', () => {
  it('one section per content group, in content order, holding every track', () => {
    const sections = librarySections(libraryFixture());
    expect(sections.map((s) => [s.group, s.cards.map((c) => c.trackId)])).toEqual([
      ['Chords', ['major-diatonic-chords', 'minor-diatonic-chords']],
      [
        'Voice leading',
        ['inversion-shapes', 'smooth-progressions', 'bass-and-chords', 'minor-progressions'],
      ],
      ['Songs', ['songs']],
      ['7th chords', ['diatonic-sevenths', 'two-five-one']],
      ['Scales', ['major-scales', 'minor-scales', 'pentatonic-scales']],
      ['Blues', ['twelve-bar-blues', 'blues-scale']],
      ['Melody', ['arpeggios', 'melody-echo']],
      ['Ear training', ['ear-training']],
    ]);
    expect(sections.flatMap((s) => s.cards).length).toBe(buildTracks().length);
  });

  it('a new track in a new group gets its own section with no renderer change', () => {
    const extra: TrackCardDto = { ...byId('major-scales'), trackId: 'modes', group: 'Modes' };
    const sections = librarySections([...libraryFixture(), extra]);
    expect(sections.at(-1)).toMatchObject({ group: 'Modes', cards: [{ trackId: 'modes' }] });
  });
});

describe('libraryCard', () => {
  it('in progress: warm, linked, bar at done/total, joined', () => {
    expect(libraryCard(byId('major-diatonic-chords'))).toMatchObject({
      to: '/tracks/major-diatonic-chords',
      status: 'In progress',
      tone: 'warm',
      progress: 3 / 12,
      progressText: '3 of 12 keys · C, G, D',
      nextText: 'Next: A',
      joined: true,
    });
  });

  it('not joined yet: cool "Ready to start", empty bar', () => {
    expect(libraryCard(byId('major-scales'))).toMatchObject({
      to: '/tracks/major-scales',
      status: 'Ready to start',
      tone: 'cool',
      progress: 0,
      joined: false,
    });
  });

  it('a ladder track in progress shows the current level', () => {
    expect(libraryCard(byId('ear-training')).nextText).toBe('Intervals · Level 3');
  });

  it('unavailable: muted "Coming soon", no link, no bar', () => {
    expect(libraryCard(comingSoon)).toMatchObject({
      to: null,
      status: 'Coming soon',
      tone: 'muted',
      progress: null,
      progressText: null,
    });
  });
});

describe('LibraryView', () => {
  function renderLibrary() {
    const cards = [...libraryFixture(), comingSoon];
    render(
      <MemoryRouter>
        <LibraryView streakDays={8} xp={1240} sections={librarySections(cards)} />
      </MemoryRouter>,
    );
  }

  it('renders grouped sections with cards linking to each map', () => {
    renderLibrary();
    const sections = screen.getAllByTestId('library-section');
    expect(sections.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'Chords',
      'Voice leading',
      'Songs',
      '7th chords',
      'Scales',
      'Blues',
      'Melody',
      'Ear training',
    ]);
    const scales = screen.getByTestId('library-card-major-scales');
    expect(scales.getAttribute('href')).toBe('/tracks/major-scales');
    expect(scales.textContent).toContain('Play each major scale up and down');
    expect(within(scales).getByTestId('library-card-status').textContent).toBe('Ready to start');
  });

  it('marks joined tracks and keeps unavailable ones as plain cards', () => {
    renderLibrary();
    expect(
      within(screen.getByTestId('library-card-minor-scales')).getByTestId('library-card-joined')
        .textContent,
    ).toBe('In your daily plan');
    const soon = screen.getByTestId('library-card-modes');
    expect(soon.tagName).toBe('DIV');
    expect(soon.textContent).toContain('Coming soon');
  });

  it('while loading, only the header and intro render', () => {
    render(
      <MemoryRouter>
        <LibraryView streakDays={8} xp={1240} sections={undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tracks');
    expect(screen.queryAllByTestId('library-section')).toHaveLength(0);
  });
});
