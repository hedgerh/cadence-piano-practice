import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed, fakeKeyboard } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 08 — Practice (Practice.dc.html, docs/engine.md §5, §6 defaults 1–7).

type DevWindow = {
  __cadenceDev?: {
    midi: { press(m: number): void; release(m: number): void; releaseAll(): void };
  };
};

const INK = 'rgb(33, 27, 22)'; // --ink #211B16

/** A major, one voicing per step: ii is an inversion, IV doubles its root. */
const VOICINGS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['I', [57, 61, 64]], // A3 C♯4 E4
  ['ii', [62, 66, 71]], // D4 F♯4 B4 — first inversion
  ['iii', [61, 64, 68]], // C♯4 E4 G♯4
  ['IV', [50, 54, 57, 62]], // D3 F♯3 A3 D4 — doubled root
  ['V', [52, 56, 59]], // E3 G♯3 B3
  ['vi', [54, 57, 61]], // F♯3 A3 C♯4
  ['vii°', [56, 59, 62]], // G♯3 B3 D4
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
  // Matched: the played keys flash teal (engine.md §6.6), then auto-advance after ~600 ms.
  await expect(
    page.getByTestId('practice-keyboard').locator(`[data-midi="${notes[0]}"]`),
  ).toHaveAttribute('data-state', 'correct');
  await expect(practice).not.toHaveAttribute('data-phase', 'matched', { timeout: 3000 });
  await releaseAll(page);
  if (i < 6) await expect(practice).toHaveAttribute('data-current', String(i + 1));
}

function sessionIdFrom(page: Page): string {
  const id = new URL(page.url().replace('#', '')).searchParams.get('session');
  if (id === null) throw new Error(`no ?session= in ${page.url()}`);
  return id;
}

test('practice: A major via dev MIDI — auto-advance, resume, Show-me persistence, finish', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await go(page, '/practice/a-major');

    // sessions.start runs on mount and writes ?session= into the URL.
    await expect(page.getByTestId('numeral')).toHaveText('I');
    await expect(page).toHaveURL(/session=/);
    const sessionId = sessionIdFrom(page);

    // ---- probes (docs/ui.md §5) ----
    await expectStyle(page.getByTestId('numeral'), {
      fontSize: '104px',
      fontWeight: '700',
      fontFamily: /Fredoka/,
      lineHeight: '104px',
      letterSpacing: '-2px',
    });
    await expectSize(page.getByTestId('practice-keyboard'), { width: 661 });
    await expectSize(page.getByTestId('practice-keyboard').locator('[data-key="white"]').first(), {
      width: 44,
      height: 150,
    });
    const hint = page.getByTestId('hint-button');
    await expect(hint).toHaveText('Give me a hint');
    await expectStyle(hint, {
      height: '48px',
      borderTopLeftRadius: '14px',
      borderTop: `2px solid ${INK}`,
      boxShadow: `${INK} 0px 4px 0px 0px`,
      fontSize: '15px',
      fontWeight: '800',
    });
    await expectStyle(page.getByTestId('task-header'), { height: '76px' });

    // ---- play I, ii (inversion), iii ----
    for (let i = 0; i < 3; i++) await play(page, i);
    await expect(page.getByTestId('practice-count')).toHaveText('3 of 7 chords');

    // ---- Show me persists per track (tracks.setSettings) and the footer is `all` only ----
    await page.getByRole('button', { name: 'Numerals only' }).click();
    await expect(page.getByTestId('chord-name')).toHaveCount(0);
    await expect(page.getByTestId('practice-strip')).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await invoke(page, 'tracks.overview', { trackId: 'major-diatonic-chords' })).visibility,
      )
      .toBe('num');

    // ---- reload mid-level: resumes at chord 4 with I–iii done, visibility restored ----
    await page.reload();
    await fakeKeyboard(page);
    await expect(page.getByTestId('chord-no')).toHaveText('Chord 4 of 7');
    await expect(page.getByTestId('practice-count')).toHaveText('3 of 7 chords');
    await expect(page.getByRole('button', { name: 'Numerals only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'All 7 chords' }).click();
    await expect(page.getByTestId('chord-name')).toHaveText('D major');
    await expect(page.getByTestId('strip-chip-2')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('strip-chip-3')).toHaveAttribute('data-state', 'current');

    // ---- IV (doubled), V, vi, vii° ----
    for (let i = 3; i < 7; i++) await play(page, i);

    const finished = page.getByTestId('practice-finished');
    await expect(finished).toContainText('All seven. Nice.');
    await expect(finished).toContainText('A major is in your hands now.');
    await expect(page.getByTestId('practice-count')).toHaveText('7 of 7 chords');
    await expect(page.getByTestId('hint-button')).toHaveCount(0);

    // Every step was posted clean.
    await expect
      .poll(async () => (await invoke(page, 'sessions.get', { sessionId })).results.length)
      .toBe(7);
    const recorded = await invoke(page, 'sessions.get', { sessionId });
    expect(recorded.results.map((r) => r.result)).toEqual(Array(7).fill('clean'));

    // ---- Finish the key → sessions.finish → /complete/:sessionId ----
    await page.getByTestId('finish-key').click();
    await expect(page).toHaveURL(new RegExp(`#/complete/${sessionId}`));
    const after = await invoke(page, 'sessions.get', { sessionId });
    expect(after.finishedAt).not.toBeNull();

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('practice dev screen: design default and hint 2 screenshots', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await go(page, '/dev/screens/practice');

    // Practice:136 — chord 3 of 7, vis all, no hint.
    await expect(page.getByTestId('chord-no')).toHaveText('Chord 3 of 7');
    await expect(page.getByTestId('numeral')).toHaveText('iii');
    await expect(page.getByTestId('chord-name')).toHaveText('C♯ minor');
    await expect(page.getByTestId('practice-count')).toHaveText('2 of 7 chords');
    await expect(page.getByTestId('note-chips')).toHaveCount(0);
    await expectStyle(page.getByTestId('numeral'), { fontSize: '104px' });
    await expectSize(page.getByTestId('practice-keyboard'), { width: 661 });
    await expectStyle(page.getByTestId('strip-chip-2'), {
      height: '64px',
      backgroundColor: 'rgb(255, 138, 76)',
      boxShadow: 'rgb(255, 227, 211) 0px 0px 0px 4px',
    });
    await expectStyle(page.getByTestId('practice-progress').locator('[data-state]').first(), {
      height: '10px',
      backgroundColor: 'rgb(91, 214, 184)',
    });
    await expect(page.getByTestId('mark-played')).toHaveText('No keyboard? Mark as played');
    await page.screenshot({ path: 'e2e/screenshots/08-practice.png' });

    // Hint 1 → note names; hint 2 → keys lit tangerine (hintFor placement C♯4 E4 G♯4).
    await go(page, '/dev/screens/practice?hint=1');
    await expect(page.getByTestId('note-chips')).toHaveText('C♯EG♯');
    await expect(page.getByTestId('hint-button')).toHaveText('Show it on the keys');
    await go(page, '/dev/screens/practice?hint=2');
    const hint = page.getByTestId('hint-button');
    await expect(hint).toHaveText('That is all the hints');
    await expect(hint).toBeDisabled();
    await expectStyle(hint, { backgroundColor: 'rgb(241, 235, 227)', boxShadow: 'none' });
    const keyboard = page.getByTestId('practice-keyboard');
    for (const m of [61, 64, 68]) {
      await expect(keyboard.locator(`[data-midi="${m}"]`)).toHaveAttribute('data-state', 'hint');
    }
    await expectStyle(keyboard.locator('[data-midi="64"]'), {
      backgroundColor: 'rgb(255, 138, 76)',
    });
    await page.screenshot({ path: 'e2e/screenshots/08-practice-hint2.png' });

    // Knobs: MIDI variants and the finished state.
    await go(page, '/dev/screens/practice?midi=none');
    await expect(page.getByTestId('midi-banner')).toHaveAttribute('data-status', 'no-device');
    await expect(page.getByTestId('mark-played')).toHaveText('Mark as played');
    await go(page, '/dev/screens/practice?midi=denied');
    await expect(page.getByTestId('midi-banner')).toContainText('MIDI access blocked');
    await go(page, '/dev/screens/practice?vis=num');
    await expect(page.getByTestId('chord-name')).toHaveCount(0);
    await expect(page.getByTestId('practice-strip')).toHaveCount(0);
    await go(page, '/dev/screens/practice?finished=1');
    await expect(page.getByTestId('practice-finished')).toContainText('All seven. Nice.');
  } finally {
    await app.close();
  }
});
