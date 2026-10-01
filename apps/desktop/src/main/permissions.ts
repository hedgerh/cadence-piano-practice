import { session } from 'electron';

/**
 * Chromium gates Web MIDI behind a permission. Electron rejects
 * `navigator.requestMIDIAccess()` with a SecurityError unless BOTH handlers
 * allow it: the request handler answers requestMIDIAccess(), the check handler
 * answers navigator.permissions.query() and Chromium's synchronous checks.
 *
 * Everything else (camera, notifications, geolocation...) is denied.
 */
const ALLOWED = new Set<string>(['midi', 'midiSysex']);

export function installPermissionHandlers(): void {
  const s = session.defaultSession;
  s.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED.has(permission));
  });
  s.setPermissionCheckHandler((_webContents, permission) => ALLOWED.has(permission));
}
