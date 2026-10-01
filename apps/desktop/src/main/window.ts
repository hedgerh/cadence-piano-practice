import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';

/** The designs are 1280x820; the layouts are fluid but the keyboard (661px) and circle (580px) are fixed. */
export const WINDOW = { width: 1280, height: 820, minWidth: 1100, minHeight: 720 } as const;

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    useContentSize: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FAF7F2',
    title: 'Cadence',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  // Never navigate away or open new windows; external links go to the OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env['ELECTRON_RENDERER_URL'];
    if (!(allowed && url.startsWith(allowed)) && !url.startsWith('file://')) event.preventDefault();
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
