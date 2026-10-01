// Design fixtures: sample data copied from docs/handoff/design/*.dc.html, used by the dev
// gallery (/dev/components) and the screen previews (/dev/screens/:name).
import { completeFixture } from './complete';
import { earChordFixture } from './earChord';
import { earIntervalFixture } from './earInterval';
import { earKeyFixture } from './earKey';
import { earPathFixture } from './earPath';
import { learnFixture } from './learn';
import { mainFixture } from './main';
import { pathFixture } from './circlePath';
import { practiceFixture } from './practice';

export * from './user';

/** One entry per design file; keys are the `/dev/screens/:name` names. */
export const screenFixtures = {
  main: { design: 'Main.dc.html', data: mainFixture },
  path: { design: 'Path.dc.html', data: pathFixture },
  learn: { design: 'Learn.dc.html', data: learnFixture },
  practice: { design: 'Practice.dc.html', data: practiceFixture },
  complete: { design: 'Complete.dc.html', data: completeFixture },
  'ear-path': { design: 'EarPath.dc.html', data: earPathFixture },
  'ear-interval': { design: 'EarInterval.dc.html', data: earIntervalFixture },
  'ear-chord': { design: 'EarChord.dc.html', data: earChordFixture },
  'ear-key': { design: 'EarKey.dc.html', data: earKeyFixture },
} as const;

export type ScreenName = keyof typeof screenFixtures;
