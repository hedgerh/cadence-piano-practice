import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 09 — Complete (Complete.dc.html, docs/ui.md §3, docs/engine.md §4 finishSession/XP/review).

type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
  };
};

/** A major, one voicing per step (same as practice.spec.ts). */
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

/** Play step `i` and wait for the teal flash and the auto-advance. */
async function play(page: Page, i: number): Promise<void> {
  const [numeral, notes] = VOICINGS[i] ?? ['', []];
  const practice = page.getByTestId('practice');
  await expect(page.getByTestId('chord-no')).toHaveText(`Chord ${i + 1} of 7`);
  await expect(page.getByTestId('numeral')).toHaveText(numeral);
  await press(page, notes);
  await expect(
    page.getByTestId('practice-keyboard').locator(`[data-midi="${notes[0]}"]`),
  ).toHaveAttribute('data-state', 'correct');
  await expect(practice).not.toHaveAttribute('data-phase', 'matched', { timeout: 3000 });
  await releaseAll(page);
  if (i < 6) await expect(practice).toHaveAttribute('data-current', String(i + 1));
}

const TEAL = 'rgb(91, 214, 184)';
const LAVENDER = 'rgb(205, 191, 255)';

test('complete: A major with G♯° hinted → Complete, Keep going, review due tomorrow', async () => {
  const first = await launchCadence();
  const { userData } = first;
  let { app, page } = first;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    expect((await invoke(page, 'me.get')).xpTotal).toBe(1240);
    await go(page, '/practice/a-major');
    await expect(page.getByTestId('numeral')).toHaveText('I');

    // I..vi clean; the live "+5 XP" toast follows the first recorded step.
    await play(page, 0);
    await expect(page.getByTestId('xp-toast')).toHaveText('+5 XP');
    for (let i = 1; i < 6; i++) await play(page, i);
    // vii° with a hint first (engine.md §5: hint > 0 → 'hinted').
    await expect(page.getByTestId('numeral')).toHaveText('vii°');
    await page.getByRole('button', { name: 'Give me a hint' }).click();
    await expect(page.getByTestId('practice')).toHaveAttribute('data-hint', '1');
    await play(page, 6);

    await expect(page.getByTestId('practice-finished')).toContainText('All seven. Nice.');
    // Header pills: me.get was invalidated after each recordStep (1,240 + 7 × 5).
    await expect.poll(async () => (await invoke(page, 'me.get')).xpTotal).toBe(1275);

    await page.getByTestId('finish-key').click();
    await expect(page).toHaveURL(/#\/complete\//);
    const sessionId = decodeURIComponent(page.url().split('/complete/')[1] ?? '');

    // ---- Complete.dc.html copy (engine-derived) ----
    const card = page.getByTestId('complete-card');
    await expect(page.getByTestId('complete-title')).toHaveText('A major, complete');
    await expect(page.getByTestId('complete-subtitle')).toHaveText(
      "All seven diatonic chords. That's four keys around the circle.",
    );
    const chips = page.getByTestId('complete-chips').locator('[data-state]');
    await expect(chips).toHaveCount(7);
    for (let i = 0; i < 6; i++) {
      await expect(page.getByTestId(`complete-chip-${i}`)).toHaveAttribute('data-state', 'done');
      await expectStyle(page.getByTestId(`complete-chip-${i}`), { backgroundColor: TEAL });
    }
    const hinted = page.getByTestId('complete-chip-6');
    await expect(hinted).toHaveAttribute('data-state', 'hinted');
    await expect(hinted).toContainText('vii°');
    await expect(hinted).toContainText('G♯° · hint');
    const tiles = page.getByTestId('stat-tile');
    await expect(tiles.nth(0)).toContainText(/^\d+:\d{2}time, no tempo$/);
    await expect(tiles.nth(1)).toHaveText('6 of 7chords without a hint');
    await expect(tiles.nth(2)).toHaveText('+40 XPday 8 streak kept');
    await expect(page.getByTestId('complete-track')).toHaveText(
      'Major diatonic chords · 4 of 12 keys',
    );
    await expect(page.getByTestId('complete-next-key')).toHaveText('Next on the circle: E major');
    await expect(page.getByTestId('complete-review-note')).toHaveText(
      "G♯° will come back in tomorrow's review until it's clean.",
    );
    await expect(page.getByTestId('complete-next')).toHaveText('Keep going — E major');
    await expect(page.getByTestId('complete-done')).toHaveText('Done for today');

    // ---- probes (docs/ui.md §5) ----
    await expectStyle(card, {
      borderTopLeftRadius: '28px',
      boxShadow: 'rgb(233, 224, 213) 0px 6px 0px 0px',
      paddingTop: '40px',
      paddingLeft: '44px',
    });
    await expectSize(card, { width: 760 });
    await expectSize(page.getByTestId('complete-check'), { width: 84, height: 84 });
    await expectStyle(page.getByTestId('complete-check'), {
      boxShadow: 'rgb(221, 246, 239) 0px 0px 0px 10px',
    });
    await expectStyle(page.getByTestId('complete-title'), {
      fontFamily: /Fredoka/,
      fontSize: '48px',
      fontWeight: '700',
      letterSpacing: '-1px',
    });
    await expectSize(hinted, { height: 60 });
    await expectStyle(tiles.nth(2), { backgroundColor: LAVENDER });
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33.3');
    await expect(page.getByTestId('complete').locator(':scope > [aria-hidden="true"]')).toHaveCount(
      7,
    );

    await page.screenshot({ path: 'e2e/screenshots/09-complete.png' });

    // ---- "Done for today" → Today; header pills updated without a reload ----
    await page.getByTestId('complete-done').click();
    await expect(page.getByTestId('today')).toBeVisible();
    await expect(page.getByTestId('xp-pill')).toHaveText('1,315 XP');
    await expect(page.getByTestId('streak-pill')).toContainText('8');

    // ---- back to Complete (history state) → "Keep going — E major" starts E major ----
    await page.goBack();
    await expect(page.getByTestId('complete-title')).toHaveText('A major, complete');
    await page.getByTestId('complete-next').click();
    await expect(page).toHaveURL(/#\/practice\/e-major\?session=/);
    await expect(page.getByTestId('numeral')).toHaveText('I');
    await expect(page.getByTestId('chord-name')).toHaveText('E major');

    // ---- tomorrow: the hinted G♯° is due for review ----
    await invoke(page, 'dev.seed', { scenario: 'advance-day' });
    await app.close();
    ({ app, page } = await launchCadence({ userData }));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 820 });
    await expect(page.getByTestId('today')).toBeVisible();

    const overview = await invoke(page, 'tracks.overview', { trackId: 'major-diatonic-chords' });
    const aMajor = overview.nodes?.find((n) => n.levelId === 'a-major');
    // HANDOFF §5: a first clean pass schedules every step 1 day out, so all 7 are due today.
    expect(aMajor).toMatchObject({ state: 'done', dueCount: 7 });
    const today = await invoke(page, 'plan.getToday');
    const review = today.blocks.find((b) => b.type === 'review');
    expect(review).toBeDefined();
    const rows = page.getByTestId('block-row');
    await expect(rows.filter({ hasText: 'Review · due today' })).toHaveCount(1);
    // engine.md §4 PlanService: one review block = the level with the most due steps (ties:
    // earliest due_on, then content order). With day8's seeded history D major ties A major
    // at 7 due and wins on order, so the block may not be A major; see the task Notes.
    if (review?.levelId === 'a-major') {
      await expect(rows.filter({ hasText: 'Review · due today' })).toContainText('vii°');
    }

    // ---- /complete/:id without router state renders read-only from sessions.get/finish ----
    await go(page, `/complete/${encodeURIComponent(sessionId)}`);
    await expect(page.getByTestId('complete-title')).toHaveText('A major, complete');
    await expect(page.getByTestId('complete-review-note')).toHaveText(
      "G♯° will come back in tomorrow's review until it's clean.",
    );
    expect((await invoke(page, 'me.get')).xpTotal).toBe(1315);

    // A review of A major carries G♯° (vii°) as the one hinted step, due today.
    const reviewSession = await invoke(page, 'sessions.start', {
      levelId: 'a-major',
      kind: 'review',
    });
    expect(reviewSession.steps.map((s) => [s.label, s.lastResult])).toEqual([
      ['I', 'clean'],
      ['ii', 'clean'],
      ['iii', 'clean'],
      ['IV', 'clean'],
      ['V', 'clean'],
      ['vi', 'clean'],
      ['vii°', 'hinted'],
    ]);
    expect(reviewSession.steps[6]?.dueOn).toBe(today.day);

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('complete dev screen: design fixture and ?skipped=1,4', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await go(page, '/dev/screens/complete');
    await expect(page.getByTestId('complete-title')).toHaveText('A major, complete');
    await expect(page.getByTestId('stat-tile').nth(0)).toHaveText('2:14time, no tempo');
    await expect(page.getByTestId('complete-next')).toHaveText('Keep going — E major');

    await go(page, '/dev/screens/complete?skipped=1,4');
    await expect(page.getByTestId('complete')).toHaveAttribute('data-skipped', '2');
    for (const i of [1, 4]) {
      const chip = page.getByTestId(`complete-chip-${i}`);
      await expect(chip).toHaveAttribute('data-state', 'skipped');
      await expectStyle(chip, { borderTopStyle: 'dashed' });
    }
    await expect(page.getByTestId('complete-subtitle')).toHaveText(
      "Five of seven played, two skipped for now. That's four keys around the circle.",
    );
    await expect(page.getByTestId('complete-review-note')).toHaveText(
      'Bm, E and G♯° come back tomorrow.',
    );
    await expect(page.getByTestId('complete-replay')).toHaveText('Play the two you skipped');
    await expect(page.getByTestId('complete-next')).toHaveText('Keep going — E major');
    await expect(page.getByTestId('complete-done')).toHaveText('Done for today');
    await page.screenshot({ path: 'e2e/screenshots/09-complete-skipped.png' });
  } finally {
    await app.close();
  }
});
