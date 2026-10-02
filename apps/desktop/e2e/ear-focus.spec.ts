import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';

// engine.md §4 focus rounds ("Drill what you missed", docs/decisions.md "Adaptive ear selection
// and focus rounds"): finish Intervals L3 with a miss, drill the misses and their neighbours,
// and leave the level's pass state untouched.

type EarHook = { currentAnswer: string | null; q: number };
type DevWindow = { __cadenceDev?: { ear?: EarHook } };

const ACTIVE = ['P1', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'];
const SEMITONES: Record<string, number> = { P1: 0, M2: 2, m3: 3, M3: 4, P4: 5, P5: 7, P8: 12 };

async function ready(page: Page, q: number): Promise<string> {
  const drill = page.getByTestId('ear-drill');
  await expect(drill).toHaveAttribute('data-q', String(q));
  await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });
  const hook = await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.ear);
  if (!hook) throw new Error('window.__cadenceDev.ear missing');
  expect(hook.q).toBe(q);
  return hook.currentAnswer ?? '';
}

async function pick(page: Page, id: string): Promise<void> {
  await page.getByTestId(`answer-${id}`).click();
  await expect(page.getByTestId('ear-drill')).toHaveAttribute('data-phase', 'answered');
  await page.getByTestId('feedback-next').click();
}

/** The neighbours a focus round adds for a missed interval: 1–2 semitones away, else nearest. */
function withNeighbours(missed: ReadonlySet<string>): Set<string> {
  const out = new Set(missed);
  for (const m of missed) {
    const dist = (o: string) => Math.abs((SEMITONES[o] ?? 99) - (SEMITONES[m] ?? -99));
    const near = ACTIVE.filter((o) => dist(o) === 1 || dist(o) === 2);
    const others = ACTIVE.filter((o) => dist(o) > 0);
    const min = Math.min(...others.map(dist));
    for (const o of near.length > 0 ? near : others.filter((x) => dist(x) === min)) out.add(o);
  }
  return out;
}

test('ear focus round: "Drill what you missed" drills misses + neighbours, level untouched', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    const session = await invoke(page, 'sessions.start', { levelId: 'intervals-3', kind: 'learn' });
    await go(page, `/ear/intervals-3?session=${session.sessionId}`);

    // ---- a normal L3 round: miss every question asking the first question's interval ----
    let missedAnswer = '';
    for (let q = 0; q < 10; q++) {
      const answer = await ready(page, q);
      if (q === 0) missedAnswer = answer;
      const miss = answer === missedAnswer;
      await pick(page, miss ? (ACTIVE.find((id) => id !== answer) ?? '') : answer);
    }
    await expect(page).toHaveURL(/#\/ear\/results\/[^/?]+$/);
    const results = page.getByTestId('ear-results');
    const judged = await results.getAttribute('data-result');
    expect(['pass', 'fail']).toContain(judged);
    const before = await invoke(page, 'tracks.overview', { trackId: 'ear-training' });

    // ---- "Drill what you missed" → a focus session on the same level ----
    const drillButton = page.getByTestId('ear-results-drill');
    await expect(drillButton).toHaveText('Drill what you missed');
    await drillButton.click();
    await expect(page).toHaveURL(/#\/ear\/intervals-3\?session=[^&]+$/);
    await expect(page.getByTestId('task-header')).toContainText('Focus · the ones you missed');
    await expect(page.getByTestId('ear-count')).toHaveText('0 right · question 1 of 10');

    const allowed = withNeighbours(new Set([missedAnswer]));
    const asked: string[] = [];
    for (let q = 0; q < 10; q++) {
      const answer = await ready(page, q);
      asked.push(answer);
      if (q === 0) await page.screenshot({ path: 'e2e/screenshots/ear-focus-drill.png' });
      await pick(page, answer);
    }
    for (const a of asked) expect([...allowed]).toContain(a);
    expect(asked).toContain(missedAnswer);
    // The missed interval is weighted: it shows up more than once.
    expect(asked.filter((a) => a === missedAnswer).length).toBeGreaterThanOrEqual(2);

    // ---- focus results: no judgement, no +40, "Drill again" / "Back to Level 3" ----
    await expect(page).toHaveURL(/#\/ear\/results\/[^/?]+$/);
    await expect(results).toHaveAttribute('data-result', 'focus');
    await expect(page.getByTestId('ear-results-title')).toHaveText('Focus round');
    await expect(page.getByTestId('ear-results-subtitle')).toContainText('10 of 10 right');
    await expect(page.getByTestId('ear-results-stats')).not.toContainText('+40 XP');
    await expect(page.getByTestId('ear-results-drill')).toHaveText('Drill again');
    await expect(page.getByTestId('ear-results-back')).toHaveText('Back to Level 3');
    await expect(page.getByTestId('ear-results-next')).toHaveCount(0);
    await page.screenshot({ path: 'e2e/screenshots/ear-focus-results.png' });

    // ---- the level's pass state is unchanged by the focus round ----
    const after = await invoke(page, 'tracks.overview', { trackId: 'ear-training' });
    expect(after.progress).toEqual(before.progress);
    expect(after.stages).toEqual(before.stages);

    // ---- "Back to Level 3" starts a normal session ----
    await page.getByTestId('ear-results-back').click();
    await expect(page).toHaveURL(/#\/ear\/intervals-3\?session=[^&]+$/);
    await expect(page.getByTestId('task-header')).toContainText('Name it, then play it back');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
