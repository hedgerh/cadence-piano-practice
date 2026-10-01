import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log/main';
import type { OpenedDatabase } from '@cadence/db';
import { loadContent } from './content';
import { databasePath, openAppDatabase } from './db';
import { loadClockOffset } from './dev/clockOffset';
import { buildHandlers, type RuntimeEnv } from './ipc/handlers';
import { registerHandlers } from './ipc/register';
import { installPermissionHandlers } from './permissions';
import { composeServices } from './services';
import { createMainWindow } from './window';

// Startup sequence: docs/architecture.md §4.

// e2e and dev runs point userData at a throwaway folder so real progress is untouched.
const userDataOverride = process.env['CADENCE_USER_DATA'];
if (userDataOverride) app.setPath('userData', userDataOverride);

const env: RuntimeEnv = {
  dev: !app.isPackaged,
  e2e: process.env['CADENCE_E2E'] === '1',
};

// §4.1 Web Audio: allow the synth to start without a prior gesture (belt and braces;
// the renderer still resumes the AudioContext on first click).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// §4.7 electron-log to userData/logs (after the CADENCE_USER_DATA override).
log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log');
log.transports.file.level = 'info';
log.initialize();
log.errorHandler.startCatching();

let database: OpenedDatabase | null = null;

// Unpackaged runs have no embedded exe icon; point the window at the generated one.
const windowIcon = app.isPackaged ? undefined : join(app.getAppPath(), 'resources', 'icon.ico');

function start(): void {
  // §4.2 both MIDI permission handlers.
  installPermissionHandlers();

  const userData = app.getPath('userData');

  // §4.3 SQLite (WAL, foreign keys) + bundled Drizzle migrations.
  const opened = openAppDatabase();
  database = opened;
  log.info(
    `Database ${databasePath()}: applied ${opened.migrations.applied} migration(s), ` +
      `${opened.migrations.total} total`,
  );

  // §4.4 content: throws in dev, logs in prod.
  const content = loadContent(env.dev, log);

  // §4.5 composition root + IPC. The clock offset (advance-day) is honoured only under e2e.
  const { services, clock } = composeServices(
    database,
    content,
    env.e2e ? loadClockOffset(userData) : 0,
  );
  const registered = registerHandlers(
    ipcMain,
    buildHandlers({ services, clock, version: app.getVersion(), userDataPath: userData, env }),
    { onError: (channel, err) => log.warn(`IPC ${channel} rejected`, err) },
  );

  // §4.6 the window.
  createMainWindow(windowIcon);

  log.info(
    `Cadence ${app.getVersion()} started; userData=${userData}; ` +
      `dev=${env.dev} e2e=${env.e2e}; ${registered.length} IPC channels` +
      (clock.offsetMs ? `; clock offset ${clock.offsetMs}ms` : ''),
  );
}

app
  .whenReady()
  .then(() => {
    start();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow(windowIcon);
    });
  })
  .catch((err: unknown) => {
    log.error('Startup failed', err);
    if (app.isPackaged) {
      dialog.showErrorBox(
        'Cadence could not start',
        `${err instanceof Error ? err.message : String(err)}\n\nSee ${join(app.getPath('userData'), 'logs')}`,
      );
    }
    app.quit();
  });

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  database?.sqlite.close();
  database = null;
});
