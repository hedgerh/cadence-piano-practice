import { type Services, type SystemClock, seed } from '@cadence/core';
import type { Handlers } from '../../shared/ipc/contracts';
import { join } from 'node:path';
import { saveClockOffset } from '../dev/clockOffset';
import { createSongStore } from '../songs';

export interface RuntimeEnv {
  /** Unpackaged run (`pnpm dev`, e2e against `out/`). */
  dev: boolean;
  /** CADENCE_E2E=1. */
  e2e: boolean;
}

export interface HandlerContext {
  services: Services;
  clock: SystemClock;
  version: string;
  userDataPath: string;
  env: RuntimeEnv;
}

/**
 * Maps each contract channel to an engine service call (architecture.md §3). Input has already
 * been parsed by register.ts and the return value is parsed against the output schema there.
 * `dev.seed` exists only in dev and e2e runs; a packaged build never registers it.
 */
export function buildHandlers(ctx: HandlerContext): Handlers {
  const { services, clock, env } = ctx;
  const { settings, content, plan, progress } = services;
  const songs = createSongStore(join(ctx.userDataPath, 'songs'));

  const handlers: Handlers = {
    'app.ping': () => ({
      ok: true,
      version: ctx.version,
      userDataPath: ctx.userDataPath,
      env: { dev: env.dev, e2e: env.e2e },
    }),

    'me.get': () => settings.me(),
    'me.update': (patch) => settings.updateMe(patch),

    'content.tracks': () => content.summaries(),
    'content.track': ({ trackId }) => content.requireTrack(trackId),

    'plan.getToday': () => plan.getToday(),

    'tracks.overview': ({ trackId }) => progress.trackOverview(trackId),
    'tracks.setSettings': (input) => settings.setTrackSettings(input),
    'tracks.lessonSeen': ({ trackId }) => {
      settings.markLessonSeen(trackId);
    },

    'sessions.start': ({ levelId, kind, planBlockId, focus, run }) =>
      progress.startLevel(levelId, kind, planBlockId, focus, run),
    'sessions.get': ({ sessionId }) => progress.getSession(sessionId),
    'sessions.recordStep': (input) => progress.recordStep(input),
    'sessions.recordPlayback': (input) => progress.recordPlayback(input),
    'sessions.finish': (input) => progress.finishSession(input),

    'songs.list': () => songs.list(),
    'songs.get': ({ songId }) => songs.get(songId),
    'songs.import': (input) => songs.import(input),
    'songs.delete': ({ songId }) => {
      songs.delete(songId);
    },
  };

  if (env.dev || env.e2e) {
    handlers['dev.seed'] = ({ scenario }) => {
      seed(services, scenario);
      // Only e2e reloads the offset at startup (index.ts), so only e2e persists it.
      if (scenario === 'advance-day' && env.e2e) saveClockOffset(ctx.userDataPath, clock.offsetMs);
    };
  }

  return handlers;
}
