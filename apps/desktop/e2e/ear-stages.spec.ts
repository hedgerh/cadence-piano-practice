import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 13 — Scale degrees + Chord quality through the ChoiceDrill shell (seed ear-unlocked:
// every ear stage open). One question of each, answered and played back on dev MIDI.

type EarHook = { currentAnswer: string | null; notes: number[]; q: number; phase: string };
type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
    ear?: EarHook;
  };
};

const INK = 'rgb(33, 27, 22)';
const TEAL = 'rgb(91, 214, 184)'; // qualityColor(minor)
const TANGERINE = 'rgb(255, 138, 76)'; // qualityColor(major)

async function earHook(page: Page): Promise<EarHook> {
  const hook = await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.ear);
  if (!hook) throw new Error('window.__cadenceDev.ear missing');
  return hook;
}

async function openLevel(page: Page, stageId: string): Promise<string> {
  const track = await invoke(page, 'content.track', { trackId: 'ear-training' });
  const levelId = track.stages?.find((s) => s.id === stageId)?.levels[0]?.id;
  if (levelId === undefined) throw new Error(`no first level in ${stageId}`);
  const session = await invoke(page, 'sessions.start', { levelId, kind: 'learn' });
  await go(page, `/ear/${levelId}?session=${encodeURIComponent(session.sessionId)}`);
  await expect(page.getByTestId('ear-drill')).toHaveAttribute('data-q', '0');
  return levelId;
}

test('scale degrees L1: cadence button, gated prompt, feedback, single-note play-back', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'ear-unlocked');
    await openLevel(page, 'scale-degrees');
    const drill = page.getByTestId('ear-drill');
    await expect(drill).toHaveAttribute('data-kind', 'degrees');

    // The 72px outlined "Hear the key" button (EarChord:59).
    const context = page.getByTestId('ear-context-play');
    await expect(context).toHaveCount(1);
    await expectSize(context, { width: 72, height: 72 });
    await expectStyle(context, {
      backgroundColor: 'rgb(255, 255, 255)',
      borderTopColor: INK,
      boxShadow: `${INK} 0px 4px 0px 0px`,
    });
    await expect(context).toHaveAccessibleName('Hear the key of C major');
    await expect(page.getByTestId('task-header')).toContainText('Key of C major');

    // First question in the key: cadence (~3 s) then the note; answers wait for both.
    await expect(drill).toHaveAttribute('data-enabled', 'false');
    await page.waitForTimeout(2000);
    await expect(drill).toHaveAttribute('data-enabled', 'false');
    await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });

    // Chips: 1–7 with degree names; L1 enables 1, 3, 5.
    await expect(page.getByTestId('ear-chips').locator('button')).toHaveCount(7);
    await expect(page.getByTestId('answer-3')).toHaveText('3Mediant');
    for (const d of ['1', '3', '5'])
      await expect(page.getByTestId(`answer-${d}`)).toHaveAttribute('data-state', 'active');
    for (const d of ['2', '4', '6', '7'])
      await expect(page.getByTestId(`answer-${d}`)).toHaveAttribute('data-state', 'inactive');
    await expect(page.getByTestId('ear-greyed')).toHaveText(
      'Greyed-out degrees arrive in later levels.',
    );

    const hook = await earHook(page);
    const answer = hook.currentAnswer ?? '';
    await page.getByTestId(`answer-${answer}`).click();
    await expect(page.getByTestId('feedback-title')).toHaveText(`${answer} — yes.`);
    await expect(page.getByTestId('feedback-body')).toHaveText(/^That's [A-G] in C major\.$/);
    await expect(
      page.getByTestId('feedback-keyboard').locator('[data-state="correct"]'),
    ).toHaveCount(1);

    // Play it back an octave up: any octave counts.
    const [note] = hook.notes;
    await page.evaluate(
      (n) => {
        const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
        midi?.press(n);
        midi?.release(n);
      },
      (note ?? 60) + 12,
    );
    await expect(page.getByTestId('playback-line')).toHaveAttribute('data-played-back', 'true');
    await expect(page.getByTestId('playback-line')).toContainText('+5 XP');
    await page.screenshot({ path: 'e2e/screenshots/13-ear-degrees.png' });

    // Next question in the same key: no cadence auto-play, so answers enable quickly.
    await page.getByTestId('feedback-next').click();
    await expect(drill).toHaveAttribute('data-q', '1');
    await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 2500 });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('chord quality L1: no cadence button, quality-colored answer, chord play-back', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'ear-unlocked');
    await openLevel(page, 'chord-quality');
    const drill = page.getByTestId('ear-drill');
    await expect(drill).toHaveAttribute('data-kind', 'quality');
    await expect(page.getByTestId('ear-context-play')).toHaveCount(0);
    await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });

    await expect(page.getByTestId('ear-chips').locator('button')).toHaveCount(3);
    await expect(page.getByTestId('answer-major')).toContainText('Major');
    await expect(page.getByTestId('answer-diminished')).toHaveAttribute('data-state', 'inactive');
    await expect(page.getByTestId('ear-play-label')).toHaveText('Hear the chord again');

    const hook = await earHook(page);
    const answer = hook.currentAnswer ?? '';
    expect(['major', 'minor']).toContain(answer);
    await page.getByTestId(`answer-${answer}`).click();
    const title = answer === 'major' ? 'Major — yes.' : 'Minor — yes.';
    await expect(page.getByTestId('feedback-title')).toHaveText(title);
    // Answered chips take their quality color (major tangerine, minor teal).
    await expectStyle(page.getByTestId(`answer-${answer}`), {
      backgroundColor: answer === 'major' ? TANGERINE : TEAL,
    });
    await expect(
      page.getByTestId('feedback-keyboard').locator('[data-state="correct"]'),
    ).toHaveCount(3);

    // Play it back as a held chord (pitch classes, any voicing).
    await page.evaluate((ns) => {
      const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
      for (const n of ns) midi?.press(n);
    }, hook.notes);
    await expect(page.getByTestId('playback-line')).toHaveAttribute('data-played-back', 'true');
    await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.releaseAll());
    await page.screenshot({ path: 'e2e/screenshots/13-ear-quality.png' });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('dev screens: ear-degrees and ear-quality', async () => {
  const { app, page } = await launchCadence();
  try {
    await go(page, '/dev/screens/ear-degrees?phase=answered');
    await expect(page.getByTestId('feedback-title')).toHaveText('3 — yes.');
    await expect(page.getByTestId('feedback-body')).toHaveText("That's E in C major.");
    await expect(page.getByTestId('ear-context-play')).toHaveCount(1);
    await go(page, '/dev/screens/ear-quality?phase=answered');
    await expect(page.getByTestId('feedback-title')).toHaveText('Minor — yes.');
    await expect(page.getByTestId('ear-context-play')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
