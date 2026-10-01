import { app } from 'electron';
import type { Handlers } from '../../shared/ipc/contracts';

/**
 * Composition point for IPC: maps each contract channel to engine services.
 * Task 05 wires the real services (createServices in main/services.ts).
 */
export function buildHandlers(): Handlers {
  return {
    'app.ping': () => ({
      ok: true,
      version: app.getVersion(),
      userDataPath: app.getPath('userData'),
    }),
  };
}
