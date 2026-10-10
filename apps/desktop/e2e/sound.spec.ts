import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// decisions.md 2026-10-11 "Sound setting": Tone / Synth piano / Recorded piano on the ear drill,
// applied to the synth at once and saved in the profile.

type DevWindow = { __cadenceDev?: { audio: { voice(): Promise<string> } } };

const synthVoice = (page: Page) =>
  page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.audio.voice());

test('Sound setting: switch voices on the ear drill; the choice persists', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await go(page, '/tracks/ear-training');
    await page.getByTestId('ladder-start').click();
    await expect(page.getByTestId('ear-drill')).toBeVisible();

    const control = page.getByTestId('sound-control');
    await expect(control).toBeVisible();
    await expect(page.getByTestId('sound-samples')).toHaveAttribute('aria-pressed', 'true');
    expect(await synthVoice(page)).toBe('samples');
    await page.screenshot({ path: 'e2e/screenshots/20-sound-setting.png' });

    await page.getByTestId('sound-synth').click();
    await expect(page.getByTestId('sound-synth')).toHaveAttribute('aria-pressed', 'true');
    expect(await synthVoice(page)).toBe('synth');
    await expect.poll(async () => (await invoke(page, 'me.get')).settings.voice).toBe('synth');

    // Saved: a reload comes back on the synth piano.
    await page.reload();
    await expect(page.getByTestId('sound-synth')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => synthVoice(page)).toBe('synth');

    await page.getByTestId('sound-tone').click();
    expect(await synthVoice(page)).toBe('tone');
    await expect.poll(async () => (await invoke(page, 'me.get')).settings.voice).toBe('tone');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
