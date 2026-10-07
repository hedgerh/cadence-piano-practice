import { expect, test } from '@playwright/test';
import { invoke } from './ipc';
import { launchCadence } from './launch';

test('app boots, IPC answers, Web MIDI is permitted, fonts are local', async () => {
  const { app, page } = await launchCadence();
  try {
    // The root route renders whatever the Today feature currently is (stub or real screen).
    await expect(page.locator('main')).toBeVisible();
    expect(await invoke(page, 'app.ping')).toMatchObject({ ok: true });

    // Permission handlers must allow MIDI or this rejects with SecurityError.
    const inputs = await page.evaluate(async () => {
      const access = await navigator.requestMIDIAccess();
      return access.inputs.size;
    });
    expect(inputs).toBeGreaterThanOrEqual(0);

    // Fonts are bundled; both families must load with no network.
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded: string[] = [];
      document.fonts.forEach((f) => {
        if (f.status === 'loaded') loaded.push(f.family);
      });
      return loaded.join(' ');
    });
    expect(families).toMatch(/Fredoka/);
    expect(families).toMatch(/Nunito/);

    // decisions.md 2026-10-07 "Piano voice": the bundled samples decode from the built app
    // (file://, strict CSP), so the synth plays the piano rather than the fallback tone.
    const voice = await page.evaluate(() => {
      const dev = (window as { __cadenceDev?: { audio: { voice(): Promise<string> } } })
        .__cadenceDev;
      return dev ? dev.audio.voice() : 'no dev hooks';
    });
    expect(voice).toBe('piano');

    await page.setViewportSize({ width: 1280, height: 820 });
    await page.screenshot({ path: 'e2e/screenshots/00-scaffold.png' });
  } finally {
    await app.close();
  }
});
