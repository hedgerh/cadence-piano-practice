import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// Minor scales track (decisions.md 2026-10-03): sequence steps played one note at a time on
// the Practice screen, any octave, then Complete with scale copy.

type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
  };
};

const A_MINOR_UP = [57, 59, 60, 62, 64, 65, 67, 69]; // A3 B3 C4 D4 E4 F4 G4 A4

/** Tap each note: press it, then let go, like a beginner playing one finger at a time. */
async function tap(page: Page, notes: readonly number[]): Promise<void> {
  for (const n of notes) {
    await page.evaluate((m) => {
      const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
      if (!midi) throw new Error('window.__cadenceDev.midi missing');
      midi.press(m);
      midi.releaseAll();
    }, n);
  }
}

function sessionIdFrom(page: Page): string {
  const id = new URL(page.url().replace('#', '')).searchParams.get('session');
  if (id === null) throw new Error(`no ?session= in ${page.url()}`);
  return id;
}

test('minor scales: play A minor up and down, then finish with scale copy', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8', { autoContinue: false });

    // The track is playable: an available pill and a 12-key circle path.
    await go(page, '/tracks/minor-scales');
    await expect(page.getByTestId('track-pills').locator('[data-state="active"]')).toHaveText(
      'Minor scales',
    );

    await go(page, '/practice/a-minor-scale');
    const practice = page.getByTestId('practice');
    await expect(page.getByTestId('numeral')).toHaveText('Up');
    await expect(page).toHaveURL(/session=/);
    const sessionId = sessionIdFrom(page);
    await expect(page.getByTestId('chord-no')).toHaveText('Scale 1 of 2');
    await expect(page.getByTestId('chord-name')).toHaveText('A minor scale, going up');
    await expect(page.getByTestId('practice-count')).toHaveText('0 of 2 scales');
    await expect(page.getByTestId('show-me')).toHaveCount(0);

    // Half the run: the accepted notes stay lit teal.
    await tap(page, A_MINOR_UP.slice(0, 4));
    const keyboard = page.getByTestId('practice-keyboard');
    for (const m of A_MINOR_UP.slice(0, 4)) {
      await expect(keyboard.locator(`[data-midi="${m}"]`)).toHaveAttribute('data-state', 'correct');
    }
    await page.getByTestId('hint-button').click();
    await expect(page.getByTestId('note-chips')).toHaveText('ABCDEFGA');
    await page.screenshot({ path: 'e2e/screenshots/18-minor-scales-practice.png' });

    // A wrong note (D♯4) starts the run again; then the whole scale.
    await tap(page, [63]);
    await expect(keyboard.locator('[data-midi="57"]')).not.toHaveAttribute('data-state', 'correct');
    await tap(page, A_MINOR_UP);
    await expect(practice).toHaveAttribute('data-current', '1', { timeout: 3000 });

    // Down, an octave higher (any octave, still going down).
    await expect(page.getByTestId('chord-name')).toHaveText('A minor scale, going down');
    await tap(
      page,
      [...A_MINOR_UP].reverse().map((m) => m + 12),
    );
    await expect(practice).toHaveAttribute('data-phase', 'finished', { timeout: 3000 });
    await expect(page.getByTestId('practice-finished')).toContainText('Up and down. Nice.');

    const recorded = await invoke(page, 'sessions.get', { sessionId });
    expect(recorded.results.map((r) => [r.stepId, r.result])).toEqual([
      ['up', 'hinted'],
      ['down', 'clean'],
    ]);

    await page.getByTestId('finish-key').click();
    await expect(page).toHaveURL(new RegExp(`#/complete/${sessionId}`));
    await expect(
      page.getByText('Up and down, every note in order.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('scales without a hint')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/18-minor-scales-complete.png' });

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
