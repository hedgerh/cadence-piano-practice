import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

/**
 * Launches the built app (apps/desktop, main = out/main/index.js) with a throwaway userData folder
 * and CADENCE_E2E=1 so dev-only IPC (dev.seed, window.__cadenceDev) is available.
 * Run `pnpm build` first (the `e2e` script does).
 */
export async function launchCadence(): Promise<{
  app: ElectronApplication;
  page: Page;
  userData: string;
}> {
  const userData = mkdtempSync(join(tmpdir(), 'cadence-e2e-'));
  const app = await electron.launch({
    // Launch the app directory so Electron reads package.json (main, version).
    args: [resolve(__dirname, '..')],
    env: {
      ...process.env,
      CADENCE_E2E: '1',
      CADENCE_USER_DATA: userData,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page, userData };
}
