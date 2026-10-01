import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { installPermissionHandlers } from './permissions';
import { createMainWindow } from './window';
import { registerHandlers } from './ipc/register';
import { buildHandlers } from './ipc/handlers';

// e2e and dev runs point userData at a throwaway folder so real progress is untouched.
const userDataOverride = process.env['CADENCE_USER_DATA'];
if (userDataOverride) app.setPath('userData', userDataOverride);

// Web Audio: allow the synth to start without a prior gesture (belt and braces;
// the renderer still resumes the AudioContext on first click).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

log.initialize();
log.transports.file.level = 'info';
log.errorHandler.startCatching();

app
  .whenReady()
  .then(() => {
    installPermissionHandlers();

    // Task 05: open the SQLite DB, run migrations, build content, createServices(...)
    registerHandlers(buildHandlers());

    createMainWindow();
    log.info(`Cadence ${app.getVersion()} started; userData=${app.getPath('userData')}`);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  })
  .catch((err: unknown) => {
    log.error('Startup failed', err);
    app.quit();
  });

app.on('window-all-closed', () => {
  app.quit();
});
