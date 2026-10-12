import { expect, test } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// decisions.md 2026-10-11 "Descending intervals and free interval practice": the map links each
// interval stage to the free drill; the drill follows the toggles and records nothing.

test('free interval practice: from the map, toggles drive questions, nothing is recorded', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    const before = await invoke(page, 'me.get');

    await go(page, '/tracks/ear-training');
    await expect(page.getByTestId('free-practice-intervals-down')).toBeVisible();
    await page.getByTestId('free-practice-intervals').click();
    await expect(page).toHaveURL(/#\/ear-practice\/intervals\?dir=up$/);
    await expect(page.getByTestId('interval-practice')).toBeVisible();
    await expect(page.getByTestId('practice-direction-up')).toHaveAttribute('aria-pressed', 'true');
    // Every interval starts from C; G can be added as a second root.
    await expect(page.getByTestId('practice-root-0')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('practice-root-7').click();
    await expect(page.getByTestId('practice-root-7')).toHaveAttribute('aria-pressed', 'true');

    // Only the picked intervals are answers; add the tritone and "Together".
    await expect(page.getByTestId(/^practice-answer-/)).toHaveCount(5);
    await page.getByTestId('practice-interval-TT').click();
    await page.getByTestId('practice-direction-together').click();
    await expect(page.getByTestId('practice-direction-together')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The question plays itself; once it has, an answer gives feedback and a score.
    const answer = page.getByTestId('practice-answer-P5');
    await expect(answer).toBeEnabled({ timeout: 5000 });
    await answer.click();
    await expect(page.getByTestId('feedback-panel')).toBeVisible();
    await expect(page.getByTestId('practice-score')).toHaveText(/^[01] of 1 right$/);
    await page.screenshot({ path: 'e2e/screenshots/22-interval-practice.png' });
    await page.getByTestId('feedback-next').click();
    await expect(page.getByTestId('feedback-panel')).toHaveCount(0);

    // Nothing recorded: XP unchanged.
    expect((await invoke(page, 'me.get')).xpTotal).toBe(before.xpTotal);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
