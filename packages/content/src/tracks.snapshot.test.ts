// engine.md §2.2 — freezes every `${levelId}/${stepId}` so a content change that would
// orphan progress rows fails CI. Update deliberately (`vitest -u`) only with a migration plan.
import { describe, expect, it } from 'vitest';
import { stepKey } from './ids';
import { buildTracks } from './index';
import { allLevels, allSteps } from './testUtils';

describe('step keys', () => {
  const tracks = buildTracks();
  const keys = Object.fromEntries(
    tracks.map((t) => [
      t.id,
      allLevels(t).flatMap((level) => allSteps(level).map((s) => stepKey(level.id, s.id))),
    ]),
  );

  it('are globally unique', () => {
    const all = Object.values(keys).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('match the committed snapshot', () => {
    expect(keys).toMatchSnapshot();
  });
});
