import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// decisions.md 2026-10-10 "Voice leading" (task 18): a progression step on the Practice screen,
// chord by chord on the held set, each voice moving at most a whole step; and the inversions
// lesson's chord-shape tiles.

type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
  };
};

/** Let go of everything, then put `notes` down one key at a time (a real hand is never exact). */
async function hold(page: Page, notes: readonly number[]): Promise<void> {
  await page.evaluate((ms) => {
    const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
    if (!midi) throw new Error('window.__cadenceDev.midi missing');
    midi.releaseAll();
    for (const m of ms) midi.press(m);
  }, notes);
}

function sessionIdFrom(page: Page): string {
  const id = new URL(page.url().replace('#', '')).searchParams.get('session');
  if (id === null) throw new Error(`no ?session= in ${page.url()}`);
  return id;
}

const C_I = [60, 64, 67]; // C4 E4 G4
const C_IV = [60, 65, 69]; // C4 F4 A4: C stays, E→F, G→A
const C_IV_JUMP = [53, 57, 60]; // F3 A3 C4: every voice drops 7

test('voice leading: I–IV–I in C, a jump is flagged, the hint follows your hand', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8', { autoContinue: false });

    await go(page, '/practice/c-major-smooth');
    const practice = page.getByTestId('practice');
    await expect(page).toHaveURL(/session=/);
    const sessionId = sessionIdFrom(page);
    await expect(page.getByTestId('chord-no')).toHaveText('Progression 1 of 8');
    await expect(page.getByTestId('practice-count')).toHaveText('0 of 8 progressions');
    await expect(page.getByTestId('part-0')).toContainText('I');
    await expect(page.getByTestId('part-1')).toContainText('IV');
    await expect(page.getByTestId('part-2')).toContainText('I');
    await expect(page.getByTestId('part-0')).toHaveAttribute('data-state', 'current');
    const keyboard = page.getByTestId('practice-keyboard');
    await expect(keyboard).toHaveAttribute('data-variant', 'three-octave');
    await expect(page.getByTestId('hear-progression')).toBeVisible();
    await page.getByTestId('hear-progression').click();

    // I, then let go: the chord just played stays outlined, IV is next.
    await hold(page, C_I);
    await expect(page.getByTestId('part-0')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('part-1')).toHaveAttribute('data-state', 'current');
    await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.releaseAll());
    for (const m of C_I) {
      await expect(keyboard.locator(`[data-midi="${m}"]`)).toHaveAttribute(
        'data-state',
        'previous',
      );
    }

    // IV in root position, down a fifth: the right chord, but every voice jumped.
    await hold(page, C_IV_JUMP);
    await expect(page.getByTestId('too-far')).toBeVisible();
    for (const m of C_IV_JUMP) {
      await expect(keyboard.locator(`[data-midi="${m}"]`)).toHaveAttribute('data-state', 'far');
    }
    await expect(page.getByTestId('part-1')).toHaveAttribute('data-state', 'current');
    await page.screenshot({ path: 'e2e/screenshots/21-voice-leading-too-far.png' });

    // IV with C kept: accepted. Hint 2 lights the I nearest to it.
    await hold(page, C_IV);
    await expect(page.getByTestId('too-far')).toHaveCount(0);
    await expect(page.getByTestId('part-2')).toHaveAttribute('data-state', 'current');
    await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.releaseAll());
    await page.getByTestId('hint-button').click();
    await page.getByTestId('hint-button').click();
    await expect(page.getByTestId('note-chips')).toHaveText('CEG');
    for (const m of C_I) {
      await expect(keyboard.locator(`[data-midi="${m}"]`)).toHaveAttribute('data-state', 'hint');
    }
    await page.screenshot({ path: 'e2e/screenshots/21-voice-leading-practice.png' });

    await hold(page, C_I);
    await expect(practice).toHaveAttribute('data-current', '1', { timeout: 3000 });
    await expect(page.getByTestId('practice-count')).toHaveText('1 of 8 progressions');
    const recorded = await invoke(page, 'sessions.get', { sessionId });
    expect(recorded.results.map((r) => [r.stepId, r.result])).toEqual([['I-IV-I', 'hinted']]);

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('inversions lesson: one tile per shape over a shared keyboard', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');

    await go(page, '/tracks/inversion-shapes/lesson');
    await expect(page.getByTestId('learn-title')).toHaveText('Same notes, new bottom');
    await expect(page.getByTestId(/^lesson-voicing-\d$/)).toHaveCount(3);
    const keyboard = page.getByTestId('lesson-keyboard');
    await page.getByTestId('lesson-voicing-1').click();
    await expect(page.getByTestId('lesson-voicing-1')).toHaveAttribute('aria-pressed', 'true');
    for (const m of [52, 55, 60]) {
      await expect(keyboard.locator(`[data-midi="${m}"]`)).toHaveAttribute('data-state', 'hint');
    }
    await page.screenshot({ path: 'e2e/screenshots/21-inversions-lesson.png' });

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
