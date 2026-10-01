import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { invoke } from './ipc';
import { launchCadence } from './launch';

// Task 05: the engine end to end over IPC, against a real SQLite file in a temp userData.
test('day8 plan, A major session and Complete numbers persist across a relaunch', async () => {
  const first = await launchCadence();
  const { userData } = first;
  let statuses: [string, string, string][] = [];
  let xpTotal = 0;
  try {
    const page = first.page;
    const ping = await invoke(page, 'app.ping');
    expect(ping).toMatchObject({ ok: true, userDataPath: userData, env: { e2e: true } });
    expect(existsSync(join(userData, 'cadence.sqlite'))).toBe(true);

    // A fresh userData boots migrated, into first-run.
    expect((await invoke(page, 'me.get')).firstRun).toBe(true);

    await invoke(page, 'dev.seed', { scenario: 'day8' });

    // Main.dc.html: warm-up C major (done), learn A major, review G major; CTA "Start A major".
    const today = await invoke(page, 'plan.getToday');
    expect(today.blocks.map((b) => [b.type, b.levelId, b.shortTitle, b.status])).toEqual([
      ['warmup', 'c-major', 'C major', 'done'],
      ['learn', 'a-major', 'A major', 'pending'],
      ['review', 'g-major', 'G major', 'pending'],
    ]);
    expect(today.blocks.map((b) => b.title)).toEqual([
      'C major · all 7 diatonic chords',
      'A major · all 7 diatonic chords',
      'G major · all 7 diatonic chords',
    ]);
    expect(today.cta.label).toBe('Start A major');
    const me = await invoke(page, 'me.get');
    expect(me).toMatchObject({
      name: 'Harry',
      xpTotal: 1240,
      streak: { days: 8 },
      firstRun: false,
    });

    // Complete.dc.html: A major with G♯° (vii°, step d7) hinted.
    const learn = today.blocks.find((b) => b.type === 'learn');
    const session = await invoke(page, 'sessions.start', {
      levelId: 'a-major',
      kind: 'learn',
      ...(learn ? { planBlockId: learn.id } : {}),
    });
    expect(session.steps).toHaveLength(7);
    for (const [ordinal, step] of session.steps.entries()) {
      const hinted = step.id === 'd7';
      await invoke(page, 'sessions.recordStep', {
        sessionId: session.sessionId,
        stepId: step.id,
        ordinal,
        result: hinted ? 'hinted' : 'clean',
        hintLevel: hinted ? 1 : 0,
        elapsedMs: hinted ? 9_000 : 4_000,
      });
    }
    const done = await invoke(page, 'sessions.finish', {
      sessionId: session.sessionId,
      durationMs: 134_000,
    });
    expect(done.cleanCount).toBe(6);
    expect(done.hintedCount).toBe(1);
    expect(done.xp.level).toBe(40);
    expect(done.track.done).toBe(4);
    expect(done.track.nextTitle).toBe('E major');
    expect(done.xp.newTotal).toBe(1315);
    xpTotal = done.xp.newTotal;

    const after = await invoke(page, 'plan.getToday');
    statuses = after.blocks.map((b) => [b.id, b.levelId, b.status]);
    expect(statuses.map(([, , s]) => s)).toEqual(['done', 'done', 'pending']);
    expect(after.cta.label).toBe('Start G major');

    // Malformed input is rejected by main's zod parse, not silently accepted.
    await expect(
      invoke(page, 'sessions.start', { levelId: 'a-major', kind: 'nope' } as never),
    ).rejects.toThrow(/invalid/i);
  } finally {
    await first.app.close();
  }

  // Relaunch over the same userData: the persisted plan comes back unchanged.
  const second = await launchCadence({ userData });
  try {
    const today = await invoke(second.page, 'plan.getToday');
    expect(today.blocks.map((b) => [b.id, b.levelId, b.status])).toEqual(statuses);
    expect(today.cta.label).toBe('Start G major');
    const me = await invoke(second.page, 'me.get');
    expect(me.xpTotal).toBe(xpTotal);
  } finally {
    await second.app.close();
  }
});
