// /dev/screens/learn — the lesson screen fed by Learn.dc.html's fixture (no IPC).
// Knobs: ?sounding=<n> (highlight chip n, row by row; disables the hear button).
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import { learnFixture } from '../../dev/fixtures/learn';
import { LessonView, type LessonContent } from './LessonView';

export const fixtureLesson: LessonContent = {
  title: learnFixture.title,
  eyebrow: learnFixture.eyebrow,
  intro: learnFixture.intro,
  rows: learnFixture.rows,
  bridge: learnFixture.bridge,
  cta: learnFixture.cta,
  hear: { label: learnFixture.hear },
};

function LearnDevScreen() {
  const [params] = useSearchParams();
  const raw = params.get('sounding');
  const sounding = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  return (
    <LessonView
      lesson={fixtureLesson}
      backTo="/dev/screens/path"
      sounding={sounding}
      playing={sounding !== null}
      onHear={() => undefined}
      onCta={() => undefined}
    />
  );
}

export const devScreens: Record<string, ComponentType> = { learn: LearnDevScreen };
