# Releasing Cadence

Cadence ships as an unsigned per-user NSIS installer, `Cadence Setup x.y.z.exe`, built locally on Windows. There is no auto-update, code signing or Store build (out of scope; see `docs/tasks/17-packaging.md`).

## Checklist

1. **Start clean.** `git status` is empty and you are on `main`.
2. **Bump the version** in both places, keeping them identical:
   - root `package.json` → `"version"`
   - `apps/desktop/package.json` → `"version"` (this one becomes `app.getVersion()`, the installer filename and the Add/Remove Programs entry)
3. **`pnpm install`** if dependencies changed. If you bumped Electron, also run `pnpm rebuild:native` (see below).
4. **`pnpm check`**: typecheck, lint, format check and unit tests must be green.
5. **`pnpm e2e`**: builds, then Playwright drives the real app against a throwaway profile.
6. **`pnpm dist`**: writes `apps/desktop/dist/Cadence Setup x.y.z.exe` (about 118 MB) plus `win-unpacked/`.
7. **Inspect the package** (`apps/desktop/dist/win-unpacked/resources/`):
   - `app.asar.unpacked/node_modules/better-sqlite3/prebuilds/win32-x64.node` exists. better-sqlite3 13 ships N-API prebuilds instead of `build/Release/better_sqlite3.node`; either way the `.node` must sit outside `app.asar` (`asarUnpack: '**/*.node'`).
   - `drizzle/*.sql` and `drizzle/meta/_journal.json` exist (`extraResources`).
8. **Smoke the installer.** Use a clean Windows user account or VM if you can; otherwise rename `%APPDATA%\Cadence` out of the way first.
   1. Run the installer (SmartScreen: **More info → Run anyway**), finish, launch from the Start menu.
   2. First launch creates `%APPDATA%\Cadence\cadence.sqlite` and `%APPDATA%\Cadence\logs\main.log`. The log should contain, with no errors:
      ```
      Database …\Cadence\cadence.sqlite: applied N migration(s), N total
      Cadence x.y.z started; userData=…\Cadence; dev=false e2e=false; 14 IPC channels
      ```
      (14 = every contract channel except `dev.seed`, which packaged builds never register.)
   3. Onboarding appears; enter a name. With a MIDI keyboard plugged in, the keyboard pill shows it and notes sound. Without one, the computer keyboard plays notes.
   4. Today → Practice → Complete: finish one level.
   5. Quit and relaunch: you land back on Today with your XP/streak, and the log shows `applied 0 migration(s)`.
   6. Uninstall from Settings → Apps (or `Uninstall Cadence.exe`). The app folder, Start menu and desktop shortcuts go away; `%APPDATA%\Cadence` stays.
   7. Restore your own `%APPDATA%\Cadence` if you moved it.
9. **Commit and tag**: `git commit -am "Release vx.y.z"`, then `git tag vx.y.z`, then push both if you publish (`git push && git push --tags`).
10. **Publish** `Cadence Setup x.y.z.exe` wherever you share it (e.g. a GitHub release). The `.blockmap` is only for auto-update and can be skipped.

Scripted smoke (no UI clicks) for the installer, in PowerShell:

```powershell
& ".\apps\desktop\dist\Cadence Setup x.y.z.exe" /S /D=C:\Temp\CadenceTest   # /D must be last, unquoted
Start-Process C:\Temp\CadenceTest\Cadence.exe; Start-Sleep 15
Get-Content $env:APPDATA\Cadence\logs\main.log
Get-Process Cadence | Stop-Process
& "C:\Temp\CadenceTest\Uninstall Cadence.exe" /S
```

## Notes

### SmartScreen

The installer is not code-signed, so the first run shows "Windows protected your PC". Click **More info → Run anyway**. Signing would remove this; it is out of scope for local use.

### Defender exclusions (faster builds)

Real-time scanning of `node_modules` and electron-builder's output slows `pnpm install` and `pnpm dist` a lot. Optionally exclude these in Windows Security → Virus & threat protection → Manage settings → Exclusions (folder exclusions):

- the repo, e.g. `C:\Users\<you>\Code\cadence`
- electron-builder's cache: `%LOCALAPPDATA%\electron-builder\Cache`
- Electron's download cache: `%LOCALAPPDATA%\electron\Cache`

Only exclude folders you trust; this is a machine-wide security setting.

### Developer Mode for the first `pnpm dist`

electron-builder extracts tools (winCodeSign, NSIS) into its cache, and those archives contain symlinks. Without the symlink privilege the first `pnpm dist` can fail with "A required privilege is not held by the client". Turn on Settings → Privacy & security → For developers → **Developer Mode** (or run that one build from an elevated terminal). Once the cache is populated, later builds don't need it.

### Uninstall keeps user data

Uninstalling removes the program folder (default `%LOCALAPPDATA%\Programs\Cadence`), the shortcuts and the Add/Remove Programs entry, but **keeps `%APPDATA%\Cadence`** (database, logs, Chromium caches). Reinstalling picks up the same progress. To start over, delete `%APPDATA%\Cadence` by hand.

### Collecting logs for a bug report

1. Press Win+R, enter `%APPDATA%\Cadence\logs`, press Enter.
2. Attach `main.log` (and `main.old.log` if present; electron-log rotates at 1 MB).
3. Note the version from the first `Cadence x.y.z started` line, what you did, and what you expected.

If the app fails to start, the error dialog names this folder too. The database `%APPDATA%\Cadence\cadence.sqlite` contains only the learner's name and practice history; attach it only if asked (quit Cadence first so the `-wal` file is folded in).

### Native module rebuild (`pnpm rebuild:native`)

`better-sqlite3` is the only native dependency. After bumping the pinned Electron version, run `pnpm rebuild:native` (`electron-builder install-app-deps`) so it matches the new Electron, then `pnpm e2e` before `pnpm dist`. `pnpm install` also runs it via the root `postinstall`. If native rebuilds keep failing, the escape hatch is swapping `packages/db/src/client.ts` to `node:sqlite` (see `CLAUDE.md`).

### Regenerating the icon

`apps/desktop/resources/icon.ico` (16–256 px) comes from `pnpm --filter @cadence/desktop icon` (`apps/desktop/scripts/generate-icon.mjs`, no dependencies). electron-builder embeds it via `win.icon`; dev runs set it on the BrowserWindow.
