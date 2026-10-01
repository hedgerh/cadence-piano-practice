import { expect, test, type Page } from '@playwright/test';
import { fakeKeyboard, go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// decisions.md 2026-10-01 "Hands-free key loop": with `autoContinue` on (the default) the key
// finishes by itself after the last chord and Complete counts down to the next key; with it off
// Complete waits, but any key on the piano keeps going.

type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
  };
};

/** A major, one voicing per step (same as practice.spec.ts / complete.spec.ts). */
const VOICINGS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['I', [57, 61, 64]],
  ['ii', [62, 66, 71]],
  ['iii', [61, 64, 68]],
  ['IV', [50, 54, 57, 62]],
  ['V', [52, 56, 59]],
  ['vi', [54, 57, 61]],
  ['vii°', [56, 59, 62]],
];

async function press(page: Page, notes: readonly number[]): Promise<void> {
  await page.evaluate((ns) => {
    const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
    if (!midi) throw new Error('window.__cadenceDev.midi missing');
    for (const n of ns) midi.press(n);
  }, notes);
}

async function releaseAll(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.releaseAll());
}

/** Play A major's seven chords through dev MIDI, never touching the screen. */
async function playAMajor(page: Page): Promise<void> {
  const practice = page.getByTestId('practice');
  for (let i = 0; i < 7; i++) {
    const [numeral, notes] = VOICINGS[i] ?? ['', []];
    await expect(page.getByTestId('chord-no')).toHaveText(`Chord ${i + 1} of 7`);
    await expect(page.getByTestId('numeral')).toHaveText(numeral);
    await press(page, notes);
    await expect(practice).not.toHaveAttribute('data-phase', 'matched', { timeout: 3000 });
    await releaseAll(page);
    if (i < 6) await expect(practice).toHaveAttribute('data-current', String(i + 1));
  }
}

const COMPLETE_URL = /#\/complete\//;
const E_MAJOR_URL = /#\/practice\/e-major\?session=/;

test('hands-free on (default): A major finishes and moves on to E major without a click', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    expect((await invoke(page, 'me.get')).settings.autoContinue).toBe(true);
    await go(page, '/practice/a-major');
    await playAMajor(page);

    // Practice finished state: the button stays, with a "Finishing…" hint, then it finishes.
    await expect(page.getByTestId('practice-finished')).toContainText('All seven. Nice.');
    await expect(page.getByTestId('finish-key')).toBeVisible();
    await expect(page.getByTestId('auto-finish-hint')).toHaveText('Finishing…');
    await expect(page).toHaveURL(COMPLETE_URL);
    const sessionId = decodeURIComponent(page.url().split('/complete/')[1] ?? '');
    expect((await invoke(page, 'sessions.get', { sessionId })).finishedAt).not.toBeNull();

    // Complete: "Next: E major in 3…" counting down, then E major starts by itself.
    await expect(page.getByTestId('complete-title')).toHaveText('A major, complete');
    await expect(page.getByTestId('complete-countdown')).toHaveText(/^Next: E major in [321]…$/);
    await expect(page.getByTestId('complete-auto-toggle')).toBeChecked();
    await expect(page.getByTestId('complete-countdown')).toHaveText('Next: E major in 1…');
    await expect(page).toHaveURL(E_MAJOR_URL, { timeout: 5000 });
    await expect(page.getByTestId('numeral')).toHaveText('I');
    await expect(page.getByTestId('chord-name')).toHaveText('E major');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('hands-free off: Complete waits; toggle + "Stay here"; any MIDI key keeps going', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await invoke(page, 'dev.seed', { scenario: 'day8' });
    await invoke(page, 'me.update', { settings: { autoContinue: false } });
    await page.reload();
    await fakeKeyboard(page);
    expect((await invoke(page, 'me.get')).settings.autoContinue).toBe(false);
    await go(page, '/practice/a-major');
    await playAMajor(page);

    // No auto-finish: the finished state waits for the button.
    await expect(page.getByTestId('practice-finished')).toContainText('All seven. Nice.');
    await expect(page.getByTestId('auto-finish-hint')).toHaveCount(0);
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(COMPLETE_URL);
    await page.getByTestId('finish-key').click();
    await expect(page).toHaveURL(COMPLETE_URL);
    const completeUrl = page.url();

    // No countdown; Complete stays put.
    await expect(page.getByTestId('complete-title')).toHaveText('A major, complete');
    await expect(page.getByTestId('complete-countdown')).toHaveCount(0);
    await expect(page.getByTestId('complete-midi-caption')).toHaveText(
      'Play any key to keep going.',
    );
    await expect(page.getByTestId('complete-auto-toggle')).not.toBeChecked();
    await page.waitForTimeout(3500);
    expect(page.url()).toBe(completeUrl);

    // The toggle persists autoContinue and starts the countdown; "Stay here" cancels it.
    await page.getByTestId('complete-auto-toggle').check();
    await expect.poll(async () => (await invoke(page, 'me.get')).settings.autoContinue).toBe(true);
    await expect(page.getByTestId('complete-countdown')).toBeVisible();
    await page.getByTestId('complete-stay').click();
    await expect(page.getByTestId('complete-countdown')).toHaveCount(0);
    await page.waitForTimeout(3500);
    expect(page.url()).toBe(completeUrl);

    // Any key on the piano → "Keep going — E major".
    await press(page, [60]);
    await expect(page).toHaveURL(E_MAJOR_URL);
    await releaseAll(page);
    await expect(page.getByTestId('numeral')).toHaveText('I');
    await expect(page.getByTestId('chord-name')).toHaveText('E major');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
