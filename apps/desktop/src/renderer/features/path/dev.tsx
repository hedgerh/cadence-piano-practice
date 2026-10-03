// /dev/screens/path — the circle track map fed by Path.dc.html's fixture (no IPC).
// Knobs: ?track=minor (minor track, not enrolled: "Ready to start" + lesson note),
//        ?review=1 (open the "Review a finished key" card).
import { minorDiatonicChords } from '@cadence/content';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { TrackPill } from '../../components/ui/TrackPills';
import { pathFixture, trackPills as fixturePills } from '../../dev/fixtures/circlePath';
import { user } from '../../dev/fixtures/user';
import type { TrackOverviewDto } from '../shared/hooks';
import {
  circleKeys,
  ctaLabel,
  finishedKeys,
  innerRing,
  trackEyebrow,
  trackPattern,
  upNextCard,
} from './path';
import { PathView } from './PathView';
import { ReviewFinishedKey } from './ReviewFinishedKey';

const noop = () => undefined;

/** The minor track before enrolment, as `tracks.overview` reports it (engine.md §4). */
export function minorReadyOverview(): TrackOverviewDto {
  const track = minorDiatonicChords();
  const levels = track.levels ?? [];
  const first = levels[0];
  return {
    trackId: track.id,
    title: track.title,
    blurb: track.blurb,
    map: track.map,
    available: true,
    enrolled: false,
    active: false,
    visibility: 'all',
    hasLesson: true,
    lessonSeen: false,
    progress: { done: 0, total: levels.length, label: `0 of ${levels.length} keys` },
    completedTitles: '',
    nodes: levels.map((l, i) => ({
      levelId: l.id,
      title: l.title,
      label: l.title.replace(' minor', 'm'),
      state: i === 0 ? 'current' : 'upcoming',
      mastered: false,
      dueCount: 0,
    })),
    stages: null,
    upNext: first
      ? {
          levelId: first.id,
          title: first.title,
          stageTitle: null,
          blurb: first.blurb ?? '',
          label: `Start ${first.title}`,
          route: `/practice/${first.id}`,
        }
      : null,
  };
}

const DESIGN_DONE = pathFixture.keys
  .map((k, i) => ({ k, i }))
  .filter(({ k }) => k.state === 'done')
  .map(({ i }) => ({ levelId: `key-${i}`, title: `${pathFixture.keys[i]?.label ?? ''} major` }));

function PathDevScreen() {
  const [params] = useSearchParams();
  const [reviewOpen, setReviewOpen] = useState(params.get('review') === '1');
  const toggle = () => setReviewOpen((o) => !o);

  if (params.get('track') === 'minor') {
    const track = minorDiatonicChords();
    const o = minorReadyOverview();
    const ring = innerRing(track);
    const pills = fixturePills('major').map((p): TrackPill => ({
      ...p,
      state: p.id === 'minor' ? 'active' : p.state === 'locked' ? 'locked' : 'available',
    }));
    return (
      <PathView
        streakDays={user.streakDays}
        xp={user.xp}
        pills={pills}
        eyebrow={trackEyebrow(o)}
        title={o.title}
        blurb={o.blurb}
        pattern={trackPattern(track)}
        upNext={upNextCard(o)}
        ctaLabel={ctaLabel(o)}
        onCta={noop}
        canReview={finishedKeys(o).length > 0}
        reviewOpen={false}
        onToggleReview={toggle}
        circle={{
          keys: circleKeys(o, { onCurrent: noop, onDone: noop }),
          minors: ring.labels,
          complete: 0,
          total: o.progress.total,
          innerLabel: ring.caption,
        }}
      />
    );
  }

  return (
    <PathView
      streakDays={user.streakDays}
      xp={user.xp}
      pills={fixturePills('major')}
      eyebrow={pathFixture.eyebrow}
      title={pathFixture.title}
      blurb={pathFixture.blurb}
      pattern={{ title: pathFixture.patternTitle, chips: pathFixture.pattern }}
      upNext={{
        eyebrow: pathFixture.upNext.eyebrow,
        title: pathFixture.upNext.title,
        body: pathFixture.upNext.body,
        note: null,
      }}
      ctaLabel={pathFixture.cta}
      onCta={noop}
      canReview
      reviewOpen={reviewOpen}
      onToggleReview={toggle}
      review={<ReviewFinishedKey keys={DESIGN_DONE} onPick={noop} />}
      onPlayCircle={noop}
      circle={{
        keys: pathFixture.keys.map((k) => ({ ...k, onClick: noop })),
        minors: pathFixture.minors,
        complete: pathFixture.complete,
        total: 12,
        innerLabel: 'inner ring: relative minors',
      }}
    />
  );
}

export const devScreens: Record<string, ComponentType> = { path: PathDevScreen };
