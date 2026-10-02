import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 12 — Intervals drill + results (EarInterval.dc.html, docs/engine.md §5, §6 defaults 10–12)
// over the real engine: seed day8 (Intervals L1–L2 passed) → Level 3.

type EarHook = {
  currentAnswer: string | null;
  stepId: string | null;
  notes: number[];
  q: number;
  phase: string;
};
type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
    ear?: EarHook;
  };
};

const TEAL = 'rgb(91, 214, 184)'; // --teal, EarInterval:147
const LAVENDER = 'rgb(205, 191, 255)'; // --lavender, EarInterval:161
const TANGERINE = 'rgb(255, 138, 76)'; // --tangerine, EarInterval:51
const TANGERINE_TINT = 'rgb(255, 227, 211)'; // --tangerine-tint, EarInterval:148
const TANGERINE_DEEP = 'rgb(196, 74, 27)'; // --tangerine-deep, EarInterval:148
const ALL = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
const ACTIVE = ['P1', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'];
const NAMES: Record<string, string> = {
  P1: 'Unison',
  M2: 'Major 2nd',
  m3: 'Minor 3rd',
  M3: 'Major 3rd',
  P4: 'Perfect 4th',
  P5: 'Perfect 5th',
  P8: 'Octave',
};

async function earHook(page: Page): Promise<EarHook> {
  const hook = await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.ear);
  if (!hook) throw new Error('window.__cadenceDev.ear missing');
  return hook;
}

/** Wait for question `q` to be on screen with its answers enabled (after the auto-play). */
async function ready(page: Page, q: number): Promise<EarHook> {
  const drill = page.getByTestId('ear-drill');
  await expect(drill).toHaveAttribute('data-q', String(q));
  await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });
  const hook = await earHook(page);
  expect(hook.q).toBe(q);
  return hook;
}

/** Tap notes one after another on the dev MIDI input. */
async function tap(page: Page, notes: readonly number[]): Promise<void> {
  await page.evaluate((ns) => {
    const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
    if (!midi) throw new Error('window.__cadenceDev.midi missing');
    for (const n of ns) {
      midi.press(n);
      midi.release(n);
    }
  }, notes);
}

async function next(page: Page): Promise<void> {
  await page.getByTestId('feedback-next').click();
}

test('ear intervals L3 (seed day8): gating, feedback, play-back, a miss, pass screen', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await go(page, '/tracks/ear-training');
    await page.getByTestId('ladder-start').click();
    await expect(page).toHaveURL(/#\/ear\/intervals-3\?session=[^&]+$/);
    const drill = page.getByTestId('ear-drill');
    await expect(drill).toBeVisible();

    // ---- §6.10: answers disabled until the first auto-play finishes ----
    await expect(drill).toHaveAttribute('data-enabled', 'false');
    await expect(page.getByTestId('answer-P1')).toBeDisabled();

    // ---- 13 chips, only P1 M2 m3 M3 P4 P5 P8 active (EarInterval:134, 143–156) ----
    const chips = page.getByTestId('ear-chips').locator('button');
    await expect(chips).toHaveCount(13);
    for (const id of ALL) {
      await expect(page.getByTestId(`answer-${id}`)).toHaveAttribute(
        'data-state',
        ACTIVE.includes(id) ? 'active' : 'inactive',
      );
    }
    await expect(page.getByTestId('ear-greyed')).toHaveText(
      'Greyed-out intervals arrive in later levels.',
    );
    await expect(page.getByTestId('ear-prompt')).toHaveText(
      'Two notes, going up. The first one is always C.',
    );
    await expect(page.getByTestId('task-header')).toContainText('Intervals · Level 3');
    await expect(page.getByTestId('task-header')).toContainText('Name it, then play it back');
    await expect(page.getByTestId('ear-count')).toHaveText('0 right · question 1 of 10');

    // ---- probes: 112px play button with --sh-play, chips 118×64, segments 10px ----
    const play = page.getByTestId('ear-play');
    await expectSize(play, { width: 112, height: 112 });
    await expectStyle(play, {
      backgroundColor: TANGERINE,
      boxShadow: `${TANGERINE_DEEP} 0px 6px 0px 0px`,
      borderTopLeftRadius: '50%',
    });
    await expectSize(page.getByTestId('answer-P4'), { width: 118, height: 64 });
    await expectStyle(page.getByTestId('answer-P4'), {
      borderTopLeftRadius: '14px',
      boxShadow: 'rgb(33, 27, 22) 0px 4px 0px 0px',
    });
    await expectStyle(page.getByTestId('answer-TT'), { backgroundColor: 'rgb(241, 235, 227)' });
    const segs = page.getByTestId('ear-progress').locator('span');
    await expect(segs).toHaveCount(10);
    await expectStyle(segs.first(), { height: '10px', backgroundColor: TANGERINE });

    // ---- question 1: press play (replay is free), pick the right answer ----
    let hook = await ready(page, 0);
    await play.click();
    await expect(page.getByTestId('ear-play-label')).toHaveText('Hear it again');
    await page.screenshot({ path: 'e2e/screenshots/12-ear-interval.png' });
    const first = hook.currentAnswer ?? '';
    expect(ACTIVE).toContain(first);
    await page.getByTestId(`answer-${first}`).click();
    await expect(drill).toHaveAttribute('data-phase', 'answered');
    await expect(page.getByTestId('feedback-panel')).toHaveAttribute('data-correct', 'true');
    await expect(page.getByTestId('feedback-title')).toHaveText(`${NAMES[first] ?? ''} — yes.`);
    await expect(page.getByTestId('feedback-body')).toHaveText(/^C.*\. Nice ears\.$/);
    await expect(page.getByTestId(`answer-${first}`)).toHaveAttribute('data-state', 'correct');
    await expect(segs.first()).toHaveAttribute('data-state', 'done');
    // The one-octave keyboard lights the sounding notes teal (C and the target).
    const keyboard = page.getByTestId('feedback-keyboard');
    await expectSize(keyboard, { width: 332 });
    const lit = keyboard.locator('[data-state="correct"]');
    await expect(lit).toHaveCount(first === 'P1' || first === 'P8' ? 1 : 2);
    await expect(keyboard.locator('[data-midi="60"]')).toHaveAttribute('data-state', 'correct');

    // ---- play it back on dev MIDI: C4 then the target → "+5 XP" once ----
    const xpBefore = (await invoke(page, 'me.get')).xpTotal;
    const line = page.getByTestId('playback-line');
    await expect(line).toHaveAttribute('data-played-back', 'false');
    await tap(page, hook.notes);
    await expect(line).toHaveAttribute('data-played-back', 'true');
    await expect(line).toContainText('+5 XP');
    await expect.poll(async () => (await invoke(page, 'me.get')).xpTotal).toBe(xpBefore + 5);
    await tap(page, hook.notes); // once per question
    await next(page);

    // ---- question 2: a wrong pick (EarInterval:147–148, §6.12) ----
    hook = await ready(page, 1);
    const answer2 = hook.currentAnswer ?? '';
    const wrong2 = ACTIVE.find((id) => id !== answer2) ?? '';
    await page.getByTestId(`answer-${wrong2}`).click();
    await expect(page.getByTestId('feedback-panel')).toHaveAttribute('data-correct', 'false');
    await expect(page.getByTestId('feedback-title')).toHaveText(/^Not quite\. That was an? /);
    await expect(page.getByTestId('feedback-body')).toContainText(
      `You said ${(NAMES[wrong2] ?? '').toLowerCase()} — it will come back in review.`,
    );
    const right = page.getByTestId(`answer-${answer2}`);
    await expect(right).toHaveAttribute('data-state', 'correct');
    await expectStyle(right, { backgroundColor: TEAL });
    const chosen = page.getByTestId(`answer-${wrong2}`);
    await expect(chosen).toHaveAttribute('data-state', 'chosen-wrong');
    await expectStyle(chosen, {
      backgroundColor: TANGERINE_TINT,
      borderTopColor: TANGERINE_DEEP,
      borderTopStyle: 'solid',
    });
    await expect(segs.nth(1)).toHaveAttribute('data-state', 'wrong');
    await expectStyle(segs.nth(1), { backgroundColor: LAVENDER });
    await expectStyle(page.getByTestId('feedback-panel'), {
      backgroundColor: 'rgb(255, 244, 236)',
      borderTopColor: 'rgb(255, 210, 184)',
    });
    await expect(page.getByTestId('ear-count')).toHaveText('1 right · question 2 of 10');
    await page.screenshot({ path: 'e2e/screenshots/12-ear-interval-answered.png' });
    await next(page);

    // ---- questions 3–10: one more miss (a different interval), the rest right → 8 of 10 ----
    let missedAgain = false;
    for (let q = 2; q < 10; q++) {
      hook = await ready(page, q);
      const answer = hook.currentAnswer ?? '';
      const miss = !missedAgain && answer !== answer2;
      if (miss) missedAgain = true;
      const pick = miss ? (ACTIVE.find((id) => id !== answer) ?? '') : answer;
      await page.getByTestId(`answer-${pick}`).click();
      await expect(drill).toHaveAttribute('data-phase', 'answered');
      await next(page);
    }
    expect(missedAgain).toBe(true);

    // ---- pass results (ui.md §3): teal check, strip, +40 XP, "Keep going — Level 4" ----
    await expect(page).toHaveURL(/#\/ear\/results\/[^/?]+$/);
    const results = page.getByTestId('ear-results');
    await expect(results).toHaveAttribute('data-result', 'pass');
    await expect(page.getByTestId('ear-results-title')).toHaveText('Intervals · Level 3, passed');
    await expectStyle(page.getByTestId('ear-results-badge'), { backgroundColor: TEAL });
    const strip = page.getByTestId('ear-results-chips').locator('span');
    await expect(strip).toHaveCount(10);
    await expect(
      page.getByTestId('ear-results-chips').locator('[data-tone="lavender"]'),
    ).toHaveCount(2);
    await expect(page.getByTestId('ear-results-stats')).toContainText('+40 XP');
    await expect(page.getByTestId('ear-results-stats')).toContainText('8 of 10');
    // Misses are due tomorrow (engine.md §4 ReviewService).
    await expect(page.getByTestId('ear-results-review-note')).toContainText('come back tomorrow');
    await expect(page.getByTestId('ear-results-next')).toHaveText('Keep going — Level 4');
    await expect(page.getByTestId('ear-results-retry')).toHaveCount(0);
    await page.screenshot({ path: 'e2e/screenshots/12-ear-results.png' });

    // ---- "Practice Level 3 again" (decisions.md "Ear level replay"): a new review session on
    // the same level; the level stays passed (checked on the map below). ----
    const practice = page.getByTestId('ear-results-practice');
    await expect(practice).toHaveText('Practice Level 3 again');
    const passedId = /results\/([^/?]+)$/.exec(page.url())?.[1] ?? '';
    await practice.click();
    await expect(page).toHaveURL(/#\/ear\/intervals-3\?session=[^&]+$/);
    const practiceId = /session=([^&]+)$/.exec(page.url())?.[1] ?? '';
    expect(practiceId).not.toBe(passedId);
    expect(await invoke(page, 'sessions.get', { sessionId: practiceId })).toMatchObject({
      levelId: 'intervals-3',
      kind: 'review',
      finishedAt: null,
    });

    // ---- EarPath: Level 3 done. engine.md §6.9: {intervals, 4} is satisfied once L3 is
    // passed, so Scale degrees opens now (Task 13 acceptance); Chord quality stays locked. ----
    await go(page, '/tracks/ear-training');
    const rows = page.getByTestId('stage-row');
    await expect(rows).toHaveCount(5);
    const overview = await invoke(page, 'tracks.overview', { trackId: 'ear-training' });
    expect(overview.stages?.map((s) => [s.stageId, s.state])).toEqual([
      ['intervals', 'open'],
      ['scale-degrees', 'open'],
      ['chord-quality', 'locked'],
      ['chords-in-key', 'locked'],
      ['find-the-key', 'locked'],
    ]);
    await expect(rows.nth(2)).toHaveAttribute('data-state', 'locked');
    await expect(rows.nth(2)).toContainText('Unlocks at Intervals L5');
    await expect(page.getByTestId('ladder-start')).toHaveText('Start Level 4');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('ear results: fail variant "Not yet" → "Try Level 3 again" starts a new session', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    const session = await invoke(page, 'sessions.start', { levelId: 'intervals-3', kind: 'learn' });
    await go(page, `/ear/intervals-3?session=${session.sessionId}`);
    for (let q = 0; q < 10; q++) {
      const hook = await ready(page, q);
      const answer = hook.currentAnswer ?? '';
      const pick = q < 6 ? answer : (ACTIVE.find((id) => id !== answer) ?? '');
      await page.getByTestId(`answer-${pick}`).click();
      await next(page);
    }
    const results = page.getByTestId('ear-results');
    await expect(results).toHaveAttribute('data-result', 'fail');
    await expect(page.getByTestId('ear-results-title')).toHaveText('Not yet — 6 of 10');
    await expectStyle(page.getByTestId('ear-results-badge'), { backgroundColor: LAVENDER });
    await expect(
      page.getByTestId('ear-results-chips').locator('[data-tone="lavender"]'),
    ).toHaveCount(4);
    const retry = page.getByTestId('ear-results-retry');
    await expect(retry).toHaveText('Try Level 3 again');
    await retry.click();
    await expect(page).toHaveURL(/#\/ear\/intervals-3\?session=[^&]+$/);
    const id = new URL(page.url().replace('#', '')).searchParams.get('session');
    expect(id).not.toBe(session.sessionId);
    await expect(page.getByTestId('ear-drill')).toHaveAttribute('data-q', '0');
  } finally {
    await app.close();
  }
});

test('dev screens: ear-interval listen/answered and ear-results pass/fail', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await go(page, '/dev/screens/ear-interval');
    await expect(page.getByTestId('ear-drill')).toHaveAttribute('data-phase', 'idle');
    await expect(page.getByTestId('ear-count')).toHaveText('2 right · question 4 of 10');
    await expect(page.getByTestId('ear-play-label')).toHaveText('Play');
    await go(page, '/dev/screens/ear-interval?phase=answered');
    await expect(page.getByTestId('feedback-title')).toHaveText(
      'Not quite. That was a perfect 4th.',
    );
    await expect(page.getByTestId('feedback-body')).toHaveText(
      "C up to F. 'Here Comes the Bride' — the first two notes. You said major 3rd — it will come back in review.",
    );
    await expect(page.getByTestId('answer-M3')).toHaveAttribute('data-state', 'chosen-wrong');
    await go(page, '/dev/screens/ear-results?result=fail');
    await expect(page.getByTestId('ear-results-title')).toHaveText('Not yet — 6 of 10');
    await go(page, '/dev/screens/ear-results?result=pass');
    await expect(page.getByTestId('ear-results-next')).toHaveText('Keep going — Level 4');
  } finally {
    await app.close();
  }
});
