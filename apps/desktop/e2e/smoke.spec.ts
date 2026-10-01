import { expect, test } from '@playwright/test';
import { launchCadence } from './launch';

test('app boots, IPC answers, Web MIDI is permitted, fonts are local', async () => {
  const { app, page } = await launchCadence();
  try {
    await expect(page.getByTestId('shell')).toBeVisible();
    await expect(page.getByTestId('ping')).toContainText('IPC ok');

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

    await page.setViewportSize({ width: 1280, height: 820 });
    await page.screenshot({ path: 'e2e/screenshots/00-scaffold.png' });
  } finally {
    await app.close();
  }
});
