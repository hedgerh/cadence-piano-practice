import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 15 — Find the key (EarKey.dc.html). Seed ear-unlocked (Chords in a key L1–L3 passed, so
// Find the key is open), start L1, hunt for home on dev MIDI (two wrong notes, then the tonic),
// pick the mode, check the feedback and what was recorded (engine.md §6.13).

type EarHook = {
  q: number;
  phase: string;
  tonicPc?: number;
  answer?: string | null;
  found?: boolean;
};
type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
    ear?: EarHook;
  };
};

const TEAL = 'rgb(91, 214, 184)';
const SAND = 'rgb(241, 235, 227)';
const INK = 'rgb(33, 27, 22)';
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

async function earHook(page: Page): Promise<EarHook> {
  const hook = await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.ear);
  if (!hook) throw new Error('window.__cadenceDev.ear missing');
  return hook;
}

/** Wait for question `q` to be hunting (its phrase has started), then return the hook. */
async function huntOn(page: Page, q: number): Promise<{ tonicPc: number; answer: string }> {
  await expect(page.getByTestId('key-drill')).toHaveAttribute('data-q', String(q));
  await expect.poll(async () => (await earHook(page)).phase).toBe('listening');
  const hook = await earHook(page);
  if (hook.tonicPc === undefined || typeof hook.answer !== 'string') {
    throw new Error('find-the-key hook fields missing');
  }
  return { tonicPc: hook.tonicPc, answer: hook.answer };
}

async function tap(page: Page, midi: number): Promise<void> {
  await page.evaluate((m) => {
    const dev = (window as unknown as DevWindow).__cadenceDev?.midi;
    if (!dev) throw new Error('window.__cadenceDev.midi missing');
    dev.press(m);
    dev.release(m);
  }, midi);
}

const key = (page: Page, midi: number) =>
  page.getByTestId('key-keyboard').locator(`[data-midi="${midi}"]`);
const step = (page: Page, n: 1 | 2) =>
  page.getByTestId('key-steps').locator(`[data-testid="step-card"][data-step="${n}"]`);

test('find the key L1: tries faint, home lit in every octave, mode pick, feedback', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'ear-unlocked');

    const overview = await invoke(page, 'tracks.overview', { trackId: 'ear-training' });
    expect(overview.stages?.find((s) => s.stageId === 'find-the-key')?.state).toBe('open');
    const track = await invoke(page, 'content.track', { trackId: 'ear-training' });
    const levelId = track.stages?.find((s) => s.id === 'find-the-key')?.levels[0]?.id ?? '';
    expect(levelId).toBe('find-the-key-1');
    const session = await invoke(page, 'sessions.start', { levelId, kind: 'learn' });
    expect(session.pass).toEqual({ correct: 4, of: 5 });
    expect(session.questions).toHaveLength(5);

    // The design's screen: home E after G, then A — on the first E question when there is one.
    const tonics = session.questions.map((q) => (q.match.type === 'root' ? q.match.note : ''));
    const eAt = tonics.indexOf('E');
    const showcase = eAt >= 0 ? eAt : 0;
    const firstTry = showcase === 0 ? 1 : 0;

    await go(page, `/ear/${levelId}?session=${encodeURIComponent(session.sessionId)}`);
    const drill = page.getByTestId('key-drill');
    await expect(drill).toHaveAttribute('data-q', '0');

    // EarKey:28–29 header, 40–47 progress (5 segments, max 300).
    await expect(page.getByTestId('task-header')).toContainText('Find the key · Level 1');
    await expect(page.getByTestId('task-header')).toContainText('Hunt for home on your keyboard');
    await expect(page.getByTestId('ear-progress').locator('span')).toHaveCount(5);
    await expectStyle(page.getByTestId('ear-progress'), { maxWidth: '300px' });
    await expect(page.getByTestId('ear-count')).toHaveText('0 right · phrase 1 of 5');
    await expectSize(page.getByTestId('ear-play'), { width: 112, height: 112 });
    await expectSize(page.getByTestId('key-keyboard'), { width: 661 });

    for (let q = 0; q < showcase + 1 || q <= firstTry; q++) {
      const { tonicPc, answer } = await huntOn(page, q);
      const tonic = NAMES[tonicPc] ?? '';

      if (q === showcase) {
        // ---- Two wrong notes (a minor 3rd and a 4th above home, octave 3), then home in octave 4.
        const tryA = 48 + ((tonicPc + 3) % 12);
        const tryB = 48 + ((tonicPc + 5) % 12);
        const home = 60 + tonicPc;
        await expect(step(page, 1)).toHaveAttribute('data-state', 'current');
        await expect(step(page, 2)).toHaveAttribute('data-state', 'upcoming');
        await expect(page.getByTestId('answer-major')).toBeDisabled();
        await tap(page, tryA);
        await tap(page, tryB);
        // Spelled in the key; exact for the design's E (G, then A).
        const isE = tonic === 'E';
        await expect(step(page, 1).getByTestId('step-body')).toHaveText(
          isE ? 'Not A. Keep hunting — tries are unlimited.' : /^Not .+\. Keep hunting/,
        );
        await expect(key(page, tryA)).toHaveAttribute('data-state', 'tried');
        await expect(page.getByTestId('answer-minor')).toBeDisabled();
        await tap(page, home);

        // Step 1 done; every octave of the tonic teal; the two tries sand (EarKey:104–111).
        await expect(step(page, 1)).toHaveAttribute('data-state', 'done');
        await expect(step(page, 1).getByTestId('step-title')).toHaveText(`Home note: ${tonic}`);
        await expect(step(page, 1).getByTestId('step-body')).toHaveText(
          isE
            ? 'Found on your third try (you tried G, then A).'
            : /^Found on your third try \(you tried .+, then .+\)\.$/,
        );
        for (const m of [48 + tonicPc, 60 + tonicPc]) {
          await expect(key(page, m)).toHaveAttribute('data-state', 'home');
          await expectStyle(key(page, m), { backgroundColor: TEAL });
        }
        for (const m of [tryA, tryB]) {
          await expect(key(page, m)).toHaveAttribute('data-state', 'tried');
          await expectStyle(key(page, m), { backgroundColor: SAND });
        }
        await expect(page.getByTestId('key-keyboard').locator('[data-state="home"]')).toHaveCount(
          2,
        );
        await expect(step(page, 2)).toHaveAttribute('data-state', 'current');
        await expect(step(page, 2).getByTestId('step-body')).toHaveText(
          `Tip: play ${tonic} with a major 3rd, then a minor 3rd. Which one matches?`,
        );

        // Answers enable once the phrase has finished (§6.10); 60px outlined ink (EarKey:92).
        await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });
        await expect(page.getByTestId('ear-play-label')).toHaveText('Hear the phrase again');
        await expect(page.getByTestId('answer-major')).toHaveText(`${tonic} major`);
        await expect(page.getByTestId('answer-minor')).toHaveText(`${tonic} minor`);
        await expectSize(page.getByTestId('answer-major'), { height: 60 });
        await expectStyle(page.getByTestId('answer-major'), {
          borderTopColor: INK,
          boxShadow: `${INK} 0px 4px 0px 0px`,
        });
        await expect(page.getByTestId('key-hint')).toHaveText("Hint: hear the phrase's last chord");
        await expect(page.getByTestId('key-hint')).toBeEnabled();
        await page.mouse.move(0, 0);
        await page.screenshot({ path: 'e2e/screenshots/15-ear-key.png' });

        // The hint plays the last chord and marks the question hinted.
        await page.getByTestId('key-hint').click();
        await page.getByTestId(`answer-${answer}`).click();
        await expect(page.getByTestId('feedback-title')).toHaveText(`${tonic} ${answer} — yes.`);
        await expect(page.getByTestId('feedback-body')).toHaveText(
          new RegExp(`^Home is ${tonic}, and it's ${answer}\\.`),
        );
        await expect(page.getByTestId('playback-line')).toHaveCount(0);
        await expect(
          page.getByTestId('feedback-keyboard').locator('[data-state="correct"]'),
        ).toHaveCount(3);
        await expect(step(page, 2)).toHaveAttribute('data-state', 'done');
        await expect(step(page, 2).getByTestId('step-body')).toHaveText(
          'Counted as hinted: you heard the last chord.',
        );
        await expect(page.getByTestId('ear-progress').locator('span').nth(q)).toHaveAttribute(
          'data-state',
          'done',
        );
        await page.screenshot({ path: 'e2e/screenshots/15-ear-key-answered.png' });
        // The answered screen still fits the default 1280×820 window.
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight),
        ).toBeLessThanOrEqual(820);
      } else {
        // ---- Home on the first try (during the phrase), then the wrong mode.
        await tap(page, 60 + tonicPc - 12);
        await expect(step(page, 1).getByTestId('step-body')).toHaveText('First try.');
        await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });
        const wrong = answer === 'major' ? 'minor' : 'major';
        await page.getByTestId(`answer-${wrong}`).click();
        await expect(page.getByTestId('feedback-title')).toHaveText(
          `Not quite. That was ${tonic} ${answer}.`,
        );
        await expect(page.getByTestId('feedback-body')).toContainText(
          `You said ${wrong} — it will come back in review.`,
        );
        await expect(page.getByTestId('ear-progress').locator('span').nth(q)).toHaveAttribute(
          'data-state',
          'wrong',
        );
      }
      await page.getByTestId('feedback-next').click();
    }

    // What was recorded (§6.13): third try → hinted (tries 3); first try, wrong mode → wrong.
    await expect
      .poll(async () => {
        const s = await invoke(page, 'sessions.get', { sessionId: session.sessionId });
        return s.results.length;
      })
      .toBeGreaterThanOrEqual(Math.max(showcase, firstTry) + 1);
    const saved = await invoke(page, 'sessions.get', { sessionId: session.sessionId });
    const byOrdinal = new Map(saved.results.map((r) => [r.ordinal, r]));
    expect(byOrdinal.get(showcase)).toMatchObject({ result: 'hinted', tries: 3 });
    expect(byOrdinal.get(firstTry)).toMatchObject({ result: 'wrong', tries: 1 });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('dev screen ear-key: tries knob and answered phase', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await go(page, '/dev/screens/ear-key?tries=G,A');
    await expect(page.getByTestId('ear-count')).toHaveText('1 right · phrase 2 of 5');
    await expect(step(page, 1).getByTestId('step-title')).toHaveText('Home note: E');
    await expect(step(page, 1).getByTestId('step-body')).toHaveText(
      'Found on your third try (you tried G, then A).',
    );
    await expect(step(page, 2).getByTestId('step-body')).toHaveText(
      'Tip: play E with a major 3rd, then a minor 3rd. Which one matches?',
    );
    for (const m of [52, 64]) await expect(key(page, m)).toHaveAttribute('data-state', 'home');
    for (const m of [55, 57]) await expect(key(page, m)).toHaveAttribute('data-state', 'tried');
    await expect(page.getByTestId('answer-minor')).toHaveText('E minor');
    // The design's exact state (EarKey.dc.html: E after G, then A), for side-by-side review.
    await page.screenshot({ path: 'e2e/screenshots/15-ear-key-design.png' });

    await go(page, '/dev/screens/ear-key?tries=&phase=answered');
    await expect(page.getByTestId('feedback-title')).toHaveText('E minor — yes.');
    await expect(step(page, 1).getByTestId('step-body')).toHaveText('First try.');
    await expect(step(page, 2).getByTestId('step-body')).toHaveText(
      'Clean: home in two tries or fewer, no hint.',
    );
  } finally {
    await app.close();
  }
});
