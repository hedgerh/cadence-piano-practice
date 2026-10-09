import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildTracks } from '@cadence/content';
import { openDatabase, runMigrations, type OpenedDatabase } from '@cadence/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { channels, devChannels, type Handlers } from '../../shared/ipc/contracts';
import { loadClockOffset } from '../dev/clockOffset';
import { composeServices } from '../services';
import { buildHandlers, type RuntimeEnv } from './handlers';
import { type IpcMainLike, registerHandlers } from './register';

const MIGRATIONS = resolve(import.meta.dirname, '../../../../../packages/db/drizzle');

type Listener = (event: unknown, input?: unknown) => Promise<unknown>;

/** Records ipc.handle registrations; `invoke` mimics ipcRenderer.invoke → ipcMain.handle. */
function fakeIpcMain() {
  const listeners = new Map<string, Listener>();
  const ipc = {
    handle: (channel: string, listener: Listener) => {
      if (listeners.has(channel))
        throw new Error(`Attempted to register a second handler for '${channel}'`);
      listeners.set(channel, listener);
    },
  } as unknown as IpcMainLike;
  const invoke = (channel: string, input?: unknown): Promise<unknown> => {
    const listener = listeners.get(channel);
    if (!listener) return Promise.reject(new Error(`No handler registered for '${channel}'`));
    return listener({}, input);
  };
  return { ipc, listeners, invoke };
}

const open: OpenedDatabase[] = [];
const tempDirs: string[] = [];

afterEach(() => {
  for (const db of open.splice(0)) db.sqlite.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fresh migrated in-memory DB + generated content + real handlers. */
function setup(env: RuntimeEnv = { dev: false, e2e: true }) {
  const database = openDatabase(':memory:');
  runMigrations(database.db, MIGRATIONS);
  open.push(database);
  const userDataPath = mkdtempSync(join(tmpdir(), 'cadence-ipc-'));
  tempDirs.push(userDataPath);
  const { services, clock } = composeServices(database, buildTracks());
  const handlers = buildHandlers({ services, clock, version: '0.0.0-test', userDataPath, env });
  return { handlers, services, clock, userDataPath, ...fakeIpcMain() };
}

describe('registerHandlers', () => {
  it('registers exactly the contract channels and never an unknown one', async () => {
    const { ipc, listeners, invoke, handlers } = setup();
    const withExtra = { ...handlers, 'evil.exec': () => 'pwned' } as Handlers;
    const registered = registerHandlers(ipc, withExtra);

    expect(registered).toEqual(channels);
    expect([...listeners.keys()].sort()).toEqual([...channels].sort());
    expect(listeners.has('evil.exec')).toBe(false);
    await expect(invoke('evil.exec')).rejects.toThrow(/No handler registered/);
  });

  it('leaves dev.seed unregistered in a packaged, non-e2e run', async () => {
    const { ipc, listeners, invoke, handlers } = setup({ dev: false, e2e: false });
    registerHandlers(ipc, handlers);
    for (const channel of devChannels) expect(listeners.has(channel)).toBe(false);
    await expect(invoke('dev.seed', { scenario: 'day8' })).rejects.toThrow(/No handler/);
    await expect(invoke('app.ping')).resolves.toMatchObject({ env: { dev: false, e2e: false } });
  });

  it('registers dev.seed in dev runs and under CADENCE_E2E', () => {
    for (const env of [
      { dev: true, e2e: false },
      { dev: false, e2e: true },
    ]) {
      const { ipc, listeners, handlers } = setup(env);
      registerHandlers(ipc, handlers);
      expect(listeners.has('dev.seed')).toBe(true);
    }
  });

  it('rejects malformed input with a ZodError before the handler runs', async () => {
    const { ipc, invoke, handlers } = setup();
    const overview = vi.fn(handlers['tracks.overview']);
    const onError = vi.fn();
    registerHandlers(ipc, { ...handlers, 'tracks.overview': overview }, { onError });

    await expect(invoke('tracks.overview', { trackId: 42 })).rejects.toBeInstanceOf(ZodError);
    await expect(invoke('tracks.overview')).rejects.toBeInstanceOf(ZodError);
    await expect(
      invoke('sessions.recordStep', {
        sessionId: 's',
        stepId: 'd1',
        ordinal: -1,
        result: 'clean',
        hintLevel: 0,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      invoke('sessions.start', { levelId: 'a-major', kind: 'speedrun' }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(invoke('dev.seed', { scenario: 'drop-tables' })).rejects.toBeInstanceOf(ZodError);
    expect(overview).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('tracks.overview', expect.any(ZodError));
  });

  it('parses handler output: a wrong shape rejects, unknown fields are stripped', async () => {
    const { ipc, invoke, handlers } = setup();
    registerHandlers(ipc, {
      ...handlers,
      'content.tracks': () =>
        [
          {
            id: 'x',
            title: 'X',
            group: 'G',
            map: 'circle-of-fifths',
            available: true,
            secret: 1,
          },
        ] as never,
      'me.get': () => ({ name: 'Harry' }) as never,
    });
    await expect(invoke('content.tracks')).resolves.toEqual([
      { id: 'x', title: 'X', group: 'G', map: 'circle-of-fifths', available: true },
    ]);
    await expect(invoke('me.get')).rejects.toBeInstanceOf(ZodError);
  });
});

// The real engine through the contract: every DTO the services return must satisfy its schema.
describe('engine over IPC (in-memory SQLite, real migrations)', () => {
  it('boots a fresh DB into first-run, then onboarding creates the profile', async () => {
    const { ipc, invoke, handlers, userDataPath } = setup();
    registerHandlers(ipc, handlers);

    await expect(invoke('app.ping')).resolves.toEqual({
      ok: true,
      version: '0.0.0-test',
      userDataPath,
      env: { dev: false, e2e: true },
    });
    await expect(invoke('me.get')).resolves.toMatchObject({ firstRun: true, midi: {} });
    await expect(
      invoke('me.update', { name: 'Harry', midi: { deviceName: 'Keystation' } }),
    ).resolves.toMatchObject({
      name: 'Harry',
      firstRun: false,
      midi: { deviceName: 'Keystation' },
    });
    const tracks = (await invoke('content.tracks')) as { id: string }[];
    expect(tracks.map((t) => t.id)).toContain('ear-training');
    await expect(invoke('content.track', { trackId: 'ear-training' })).resolves.toMatchObject({
      id: 'ear-training',
      map: 'ladder',
    });
    await expect(invoke('content.track', { trackId: 'nope' })).rejects.toThrow();
    const today = (await invoke('plan.getToday')) as { blocks: unknown[] };
    expect(Array.isArray(today.blocks)).toBe(true);
  });

  // seed.test.ts covers the numbers in depth; this proves they survive the contract.
  it('day8: plan, session round-trip and CompleteDto (Main.dc.html, Complete.dc.html)', async () => {
    const { ipc, invoke, handlers } = setup();
    registerHandlers(ipc, handlers);
    await invoke('dev.seed', { scenario: 'day8' });

    const today = (await invoke('plan.getToday')) as {
      blocks: { id: string; type: string; levelId: string; status: string }[];
      cta: { label: string };
    };
    expect(today.blocks.map((b) => [b.type, b.levelId, b.status])).toEqual([
      ['warmup', 'c-major', 'done'],
      ['learn', 'a-major', 'pending'],
      ['review', 'g-major', 'pending'],
    ]);
    expect(today.cta.label).toBe('Start A major');

    const learn = today.blocks[1];
    const session = (await invoke('sessions.start', {
      levelId: 'a-major',
      kind: 'learn',
      planBlockId: learn?.id,
    })) as { sessionId: string; steps: { id: string }[] };
    expect(session.steps).toHaveLength(7);
    for (const [ordinal, step] of session.steps.entries()) {
      const hinted = step.id === 'd7';
      await invoke('sessions.recordStep', {
        sessionId: session.sessionId,
        stepId: step.id,
        ordinal,
        result: hinted ? 'hinted' : 'clean',
        hintLevel: hinted ? 1 : 0,
        elapsedMs: 4000,
      });
    }
    const resumed = (await invoke('sessions.get', { sessionId: session.sessionId })) as {
      results: { stepId: string; result: string }[];
    };
    expect(resumed.results).toHaveLength(7);
    expect(resumed.results.find((r) => r.stepId === 'd7')?.result).toBe('hinted');
    const done = await invoke('sessions.finish', {
      sessionId: session.sessionId,
      durationMs: 134_000,
    });
    expect(done).toMatchObject({
      cleanCount: 6,
      xp: { level: 40 },
      track: { done: 4, nextTitle: 'E major' },
    });

    await expect(
      invoke('tracks.overview', { trackId: 'major-diatonic-chords' }),
    ).resolves.toMatchObject({
      progress: { done: 4 },
    });
    await expect(
      invoke('tracks.setSettings', { trackId: 'major-diatonic-chords', visibility: 'all' }),
    ).resolves.toMatchObject({ visibility: 'all' });
    await expect(
      invoke('tracks.lessonSeen', { trackId: 'minor-diatonic-chords' }),
    ).resolves.toBeUndefined();
  });

  it('ear sessions round-trip questions and play-backs', async () => {
    const { ipc, invoke, handlers } = setup();
    registerHandlers(ipc, handlers);
    await invoke('dev.seed', { scenario: 'first-run' });
    const s = (await invoke('sessions.start', { levelId: 'intervals-1', kind: 'free' })) as {
      sessionId: string;
      isEar: boolean;
      questions: { id: string; ordinal: number }[];
    };
    expect(s.isEar).toBe(true);
    expect(s.questions.length).toBeGreaterThan(0);
    const q = s.questions[0];
    await invoke('sessions.recordStep', {
      sessionId: s.sessionId,
      stepId: q?.id,
      ordinal: q?.ordinal,
      result: 'clean',
      hintLevel: 0,
    });
    const playback = (await invoke('sessions.recordPlayback', {
      sessionId: s.sessionId,
      ordinal: q?.ordinal,
    })) as { xpAwarded: number; xpTotal: number };
    expect(Object.keys(playback).sort()).toEqual(['xpAwarded', 'xpTotal']);
    expect(playback.xpAwarded).toBeGreaterThan(0);
  });

  it('advance-day moves the clock a day and persists the offset under e2e only', async () => {
    const e2e = setup({ dev: false, e2e: true });
    registerHandlers(e2e.ipc, e2e.handlers);
    await e2e.invoke('dev.seed', { scenario: 'first-run' });
    const before = ((await e2e.invoke('plan.getToday')) as { day: string }).day;
    await e2e.invoke('dev.seed', { scenario: 'advance-day' });
    const after = ((await e2e.invoke('plan.getToday')) as { day: string }).day;
    expect(after).not.toBe(before);
    expect(e2e.clock.offsetMs).toBe(86_400_000);
    expect(loadClockOffset(e2e.userDataPath)).toBe(86_400_000);

    const dev = setup({ dev: true, e2e: false });
    registerHandlers(dev.ipc, dev.handlers);
    await dev.invoke('dev.seed', { scenario: 'advance-day' });
    expect(dev.clock.offsetMs).toBe(86_400_000);
    expect(loadClockOffset(dev.userDataPath)).toBe(0);
  });
});
