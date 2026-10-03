import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// decisions.md 2026-10-03 "Circle run": "Play the whole circle" on the Path starts at C major
// and Complete chains every key clockwise regardless of completion (C → G → D → … → F), where a
// one-off session still jumps to the next uncompleted key.

type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
  };
};

/** C major, root-position triads (I ii iii IV V vi vii°). */
const C_MAJOR: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['I', [60, 64, 67]],
  ['ii', [62, 65, 69]],
  ['iii', [64, 67, 71]],
  ['IV', [65, 69, 72]],
  ['V', [67, 71, 74]],
  ['vi', [69, 72, 76]],
  ['vii°', [71, 74, 77]],
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

/** Play C major's seven chords through dev MIDI (same approach as autocontinue.spec.ts). */
async function playCMajor(page: Page): Promise<void> {
  const practice = page.getByTestId('practice');
  for (let i = 0; i < 7; i++) {
    const [numeral, notes] = C_MAJOR[i] ?? ['', []];
    await expect(page.getByTestId('chord-no')).toHaveText(`Chord ${i + 1} of 7`);
    await expect(page.getByTestId('numeral')).toHaveText(numeral);
    await press(page, notes);
    await expect(practice).not.toHaveAttribute('data-phase', 'matched', { timeout: 3000 });
    await releaseAll(page);
    if (i < 6) await expect(practice).toHaveAttribute('data-current', String(i + 1));
  }
}

const sessionIdFrom = (url: string): string =>
  decodeURIComponent(/[?&]session=([^&]+)/.exec(url)?.[1] ?? '');

test('circle run: C (completed) → G (completed) instead of jumping to A major', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    expect((await invoke(page, 'me.get')).settings.autoContinue).toBe(true);

    // ---- Path: "Play the whole circle" next to "Review a finished key" ----
    await go(page, '/tracks/major-diatonic-chords');
    const runButton = page.getByTestId('circle-run');
    await expect(runButton).toHaveText('Play the whole circle');
    const box = await runButton.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await runButton.click();

    // ---- Practice opens on C major as a review-kind run session ----
    await expect(page).toHaveURL(/#\/practice\/c-major\?session=/);
    const cSession = await invoke(page, 'sessions.get', { sessionId: sessionIdFrom(page.url()) });
    expect(cSession).toMatchObject({ levelId: 'c-major', kind: 'review', run: 'circle' });
    await expect(page.getByTestId('task-header')).toContainText('Circle run · C major');
    await playCMajor(page);

    // ---- Complete: run caption, then the countdown lands on G major (not A major) ----
    await expect(page).toHaveURL(/#\/complete\//);
    await expect(page.getByTestId('complete-title')).toHaveText('C major, complete');
    await expect(page.getByTestId('complete-run')).toHaveText('Circle run · 1 of 12');
    await expect(page.getByTestId('complete-next')).toHaveText('Keep going — G major');
    await expect(page.getByTestId('complete-countdown')).toHaveText(/^Next: G major in [321]…$/);
    await expect(page).toHaveURL(/#\/practice\/g-major\?session=/, { timeout: 6000 });
    await expect(page.getByTestId('chord-name')).toHaveText('G major');
    const gSession = await invoke(page, 'sessions.get', { sessionId: sessionIdFrom(page.url()) });
    expect(gSession).toMatchObject({ levelId: 'g-major', kind: 'review', run: 'circle' });
    await expect(page.getByTestId('task-header')).toContainText('Circle run · G major');

    // ---- A one-off (non-run) session still goes to the next uncompleted key ----
    const oneOff = await invoke(page, 'sessions.start', { levelId: 'd-major', kind: 'review' });
    expect(oneOff.run).toBeNull();
    for (const [ordinal, step] of oneOff.steps.entries()) {
      await invoke(page, 'sessions.recordStep', {
        sessionId: oneOff.sessionId,
        stepId: step.id,
        ordinal,
        result: 'clean',
        hintLevel: 0,
      });
    }
    const done = await invoke(page, 'sessions.finish', {
      sessionId: oneOff.sessionId,
      durationMs: 60_000,
    });
    expect(done.run).toBeNull();
    expect(done.next).toMatchObject({ levelId: 'a-major', run: null });

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
