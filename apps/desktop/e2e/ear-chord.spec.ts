import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed, fakeKeyboard } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 14 — Chords in a key L2 (G major) through ChoiceDrill's numerals kind (EarChord.dc.html,
// answered state). Seed ear-unlocked: every ear stage open.

type EarHook = {
  currentAnswer: string | null;
  stepId: string | null;
  notes: number[];
  q: number;
  phase: string;
};
type DevWindow = { __cadenceDev?: { ear?: EarHook } };

const INK = 'rgb(33, 27, 22)';
const PAPER = 'rgb(255, 255, 255)';
const TEAL = 'rgb(91, 214, 184)'; // --teal, EarChord:41
const LAVENDER = 'rgb(205, 191, 255)'; // --lavender, EarChord:43
const SAND_DEEP = 'rgb(237, 229, 219)'; // --sand-deep, EarChord:47
const LINE = 'rgb(239, 232, 223)'; // --line, EarChord:75
const MUTED = 'rgb(107, 97, 90)'; // --muted
const G_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const G_NAMES = ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°'];

async function earHook(page: Page): Promise<EarHook> {
  const hook = await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.ear);
  if (!hook) throw new Error('window.__cadenceDev.ear missing');
  return hook;
}

test('chords in a key L2: numeral chips, content explain, numerals-only Show me', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'ear-unlocked');

    // Chords in a key L2 is the G major level (engine.md §2.2).
    const track = await invoke(page, 'content.track', { trackId: 'ear-training' });
    const stage = track.stages?.find((s) => s.id === 'chords-in-key');
    const level = stage?.levels.find(
      (l) => (l.pool ?? []).length > 0 && (l.pool ?? []).every((s) => s.id.startsWith('g-major-')),
    );
    if (level === undefined) throw new Error('no G major level in chords-in-key');
    expect(level.title).toBe('Level 2');
    const pool = level.pool ?? [];

    // The explain copy comes from content: IV in G is EarChord:88–89 verbatim.
    const iv = pool.find((s) => s.id === 'g-major-IV');
    expect(`IV — yes, that's ${iv?.name}.`).toBe("IV — yes, that's C major.");
    expect(iv?.explain).toBe("The IV chord pulls gently away from home. In G, that's C · E · G.");

    const session = await invoke(page, 'sessions.start', { levelId: level.id, kind: 'learn' });
    await go(page, `/ear/${level.id}?session=${encodeURIComponent(session.sessionId)}`);
    const drill = page.getByTestId('ear-drill');
    await expect(drill).toHaveAttribute('data-q', '0');
    await expect(drill).toHaveAttribute('data-kind', 'numerals');
    await expect(page.getByTestId('task-header')).toContainText('Chords in a key · Level 2');
    await expect(page.getByTestId('task-header')).toContainText('Key of G major');

    // Two-button audio cluster (EarChord:57–69).
    const context = page.getByTestId('ear-context-play');
    await expectSize(context, { width: 72, height: 72 });
    await expectStyle(context, {
      backgroundColor: PAPER,
      borderTopColor: INK,
      boxShadow: `${INK} 0px 4px 0px 0px`,
    });
    await expect(context).toHaveAccessibleName('Hear the key of G major');
    await expectSize(page.getByTestId('ear-play'), { width: 112, height: 112 });
    await expect(page.getByTestId('ear-play')).toHaveAccessibleName('Hear the chord');
    await expect(page.getByTestId('ear-prompt')).toHaveText('Which chord did you hear?');
    await expect(page.getByTestId('ear-caption')).toHaveText(
      'Chord names shown — switch to numerals only in Show me, like in practice.',
    );
    await expectStyle(page.getByTestId('ear-caption'), {
      fontSize: '13px',
      fontWeight: '700',
      color: MUTED,
    });

    // Seven 104×68 chips: numeral (Fredoka 22) over the short chord name (13/800).
    const chips = page.getByTestId('ear-chips').locator('button');
    await expect(chips).toHaveCount(7);
    for (const [i, n] of G_MAJOR.entries()) {
      const chip = page.getByTestId(`answer-${n}`);
      await expect(chip).toHaveText(`${n}${G_NAMES[i]}`);
      await expectSize(chip, { width: 104, height: 68 });
    }
    await expectStyle(page.getByTestId('answer-IV').locator('span').first(), {
      fontFamily: /Fredoka/,
      fontSize: '22px',
    });
    await expectStyle(page.getByTestId('answer-IV').locator('span').nth(1), {
      fontFamily: /Nunito/,
      fontSize: '13px',
      fontWeight: '800',
    });

    // Cadence + chord auto-play first; then press play ourselves.
    await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });
    await page.getByTestId('ear-play').click();
    await expect(page.getByTestId('ear-play-label')).toHaveText('Hear the chord again');
    await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 5000 });

    // EarChord:41–52 — right, right, missed, right, right; question 6 answered right.
    for (let i = 0; i < 6; i++) {
      await expect(drill).toHaveAttribute('data-q', String(i));
      await expect(drill).toHaveAttribute('data-enabled', 'true', { timeout: 10_000 });
      const hook = await earHook(page);
      const answer = hook.currentAnswer ?? '';
      expect(G_MAJOR).toContain(answer);
      const pick = i === 2 ? (G_MAJOR.find((n) => n !== answer) ?? '') : answer;
      await page.getByTestId(`answer-${pick}`).click();
      await expect(drill).toHaveAttribute('data-phase', 'answered');
      if (i === 5) break;
      await page.getByTestId('feedback-next').click();
    }

    // Answered state: title + content body.
    const hook = await earHook(page);
    const answer = hook.currentAnswer ?? '';
    const step = pool.find((s) => s.id === hook.stepId);
    if (step === undefined) throw new Error(`no step ${hook.stepId}`);
    await expect(page.getByTestId('feedback-title')).toHaveText(
      `${answer} — yes, that's ${step.name}.`,
    );
    await expect(page.getByTestId('feedback-body')).toHaveText(step.explain ?? '');
    await expect(page.getByTestId('feedback-title').locator('..')).toHaveCSS('min-width', '280px');
    await expect(
      page.getByTestId('feedback-keyboard').locator('[data-state="correct"]'),
    ).toHaveCount(3);
    await expect(page.getByTestId('feedback-next')).toHaveText('Next');

    // Chip states are progress-based: the answer teal, the rest dimmed white (EarChord:75–81).
    await expectStyle(page.getByTestId(`answer-${answer}`), {
      backgroundColor: TEAL,
      borderTopColor: TEAL,
      color: INK,
    });
    const other = G_MAJOR.find((n) => n !== answer) ?? '';
    await expect(page.getByTestId(`answer-${other}`)).toHaveAttribute('data-state', 'dimmed');
    await expectStyle(page.getByTestId(`answer-${other}`), {
      backgroundColor: PAPER,
      borderTopColor: LINE,
      color: MUTED,
    });

    // Progress bar: lavender miss at segment 3 (EarChord:41–52).
    const segs = page.getByTestId('ear-progress').locator('span');
    await expect(segs).toHaveCount(10);
    const states = await segs.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
    expect(states).toEqual([
      'done',
      'done',
      'wrong',
      'done',
      'done',
      'done',
      'empty',
      'empty',
      'empty',
      'empty',
    ]);
    await expectStyle(segs.nth(0), { backgroundColor: TEAL, height: '10px' });
    await expectStyle(segs.nth(2), { backgroundColor: LAVENDER });
    await expectStyle(segs.nth(6), { backgroundColor: SAND_DEEP });
    await expect(page.getByTestId('ear-count')).toHaveText('5 right · question 6 of 10');
    await page.screenshot({ path: 'e2e/screenshots/14-ear-chord.png' });

    // Show me → numerals only: names disappear after a reload, chips keep their size.
    await invoke(page, 'tracks.setSettings', { trackId: 'ear-training', visibility: 'num' });
    await page.reload();
    await fakeKeyboard(page);
    await expect(page.getByTestId('ear-chips').locator('button')).toHaveCount(7);
    await expect(page.getByTestId('ear-caption')).toHaveText(/^Numerals only/);
    for (const n of G_MAJOR) {
      const chip = page.getByTestId(`answer-${n}`);
      await expect(chip).toHaveText(n);
      await expect(chip.locator('span')).toHaveCount(1);
      await expectSize(chip, { width: 104, height: 68 });
    }
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('dev screen: ear-chord answered', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await go(page, '/dev/screens/ear-chord?phase=answered');
    await expect(page.getByTestId('feedback-title')).toHaveText("IV — yes, that's C major.");
    await expect(page.getByTestId('feedback-body')).toHaveText(
      "The IV chord pulls gently away from home. In G, that's C · E · G.",
    );
    await expect(page.getByTestId('ear-count')).toHaveText('5 right · question 6 of 10');
    await expect(page.getByTestId('answer-vii°')).toHaveText('vii°F♯°');
    await go(page, '/dev/screens/ear-chord?phase=answered&visibility=num');
    await expect(page.getByTestId('answer-IV')).toHaveText('IV');
  } finally {
    await app.close();
  }
});
