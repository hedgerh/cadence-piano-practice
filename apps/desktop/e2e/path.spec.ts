import { expect, test } from '@playwright/test';
import { go, seed } from './ipc';
import { launchCadence } from './launch';
import { box, expectSize, expectStyle } from './probes';

// Task 10 — the circle-of-fifths track map (Path.dc.html) over the real engine, seed day8.

const INK = 'rgb(33, 27, 22)'; // --ink #211B16
const PAPER = 'rgb(255, 255, 255)';
const LINE = 'rgb(239, 232, 223)'; // --line #EFE8DF
const LINE_STRONG = 'rgb(230, 222, 212)'; // --line-strong #E6DED4
const TANGERINE = 'rgb(255, 138, 76)';
const TEAL = 'rgb(91, 214, 184)';
const LAVENDER = 'rgb(205, 191, 255)';
const SH_CARD = 'rgb(233, 224, 213) 0px 4px 0px 0px'; // Path:89 secondary button
const SH_PRIMARY = 'rgb(196, 74, 27) 0px 5px 0px 0px'; // Path:85
const UP_NEXT = 'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°';

/** Path:104–115 — hardcoded [left, top, size] of the twelve outer nodes. */
const DESIGN_KEYS: ReadonlyArray<readonly [string, number, number, number]> = [
  ['C', 254, 22, 72],
  ['G', 370, 53, 72],
  ['D', 455, 138, 72],
  ['A', 480, 248, 84],
  ['E', 455, 370, 72],
  ['B', 370, 455, 72],
  ['G♭', 254, 486, 72],
  ['D♭', 138, 455, 72],
  ['A♭', 53, 370, 72],
  ['E♭', 22, 254, 72],
  ['B♭', 53, 138, 72],
  ['F', 138, 53, 72],
];

/** Path:117–128 — hardcoded [label, left, top] of the twelve 40px relative minors. */
const DESIGN_MINORS: ReadonlyArray<readonly [string, number, number]> = [
  ['Am', 270, 120],
  ['Em', 345, 140],
  ['Bm', 400, 195],
  ['F♯m', 420, 270],
  ['C♯m', 400, 345],
  ['G♯m', 345, 400],
  ['E♭m', 270, 420],
  ['B♭m', 195, 400],
  ['Fm', 140, 345],
  ['Cm', 120, 270],
  ['Gm', 140, 195],
  ['Dm', 195, 140],
];

test('Path (seed day8): pills, circle geometry, up next, probes, review a finished key', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await go(page, '/tracks/major-diatonic-chords');
    await expect(page.getByTestId('path')).toBeVisible();

    // ---- header: Tracks active (Path:25) ----
    await expect(
      page.getByTestId('app-header').getByRole('link', { name: 'Tracks' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('streak-pill')).toHaveText('8 day streak');
    await expect(page.getByTestId('xp-pill')).toHaveText('1,240 XP');

    // ---- pills from content.tracks (Path:41–47): the Chords group only, after "All tracks"
    // (decisions.md 2026-10-08 "Track library") ----
    await expect(page.getByTestId('all-tracks-link')).toHaveAttribute('href', '#/tracks');
    const pills = page.getByTestId('track-pills').locator('[data-state]');
    await expect(pills).toHaveText([
      'Major diatonic chords',
      'Minor diatonic chords',
      'Inversions & voice leading',
    ]);
    const states = await pills.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
    expect(states).toEqual(['active', 'available', 'locked']);
    await expect(pills.nth(2)).toHaveJSProperty('tagName', 'SPAN');
    await expectSize(pills.nth(0), { height: 44 });
    await expectStyle(pills.nth(0), { backgroundColor: INK, color: PAPER, fontSize: '15px' });
    await expectStyle(pills.nth(1), {
      backgroundColor: PAPER,
      borderTopColor: LINE_STRONG,
      borderTopWidth: '2px',
    });
    await expectStyle(pills.nth(2), { borderTopColor: LINE, color: 'rgb(107, 97, 90)' });

    // ---- intro + pattern (Path:53–76) ----
    await expect(page.getByTestId('path-eyebrow')).toHaveText('Track · 3 of 12 keys');
    await expect(page.getByTestId('path-title')).toHaveText('Major diatonic chords');
    await expectStyle(page.getByTestId('path-title'), {
      fontFamily: /Fredoka/,
      fontSize: '40px',
      fontWeight: '600',
    });
    const chips = page.getByTestId('path-pattern').locator('[data-testid^="pattern-chip-"]');
    await expect(chips).toHaveText(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    await expectSize(chips.nth(0), { height: 48 });
    await expectStyle(chips.nth(0), { backgroundColor: TANGERINE, borderTopLeftRadius: '12px' });
    await expectStyle(chips.nth(1), { backgroundColor: TEAL });
    await expectStyle(chips.nth(6), { backgroundColor: LAVENDER });
    // Path:62 — legend swatches 10px r3.
    const swatch = page.getByTestId('path-pattern').locator('span[style*="background"]').first();
    await expectSize(swatch, { width: 10, height: 10 });
    await expectStyle(swatch, { borderTopLeftRadius: '3px' });

    // ---- up next (Path:78–82) ----
    await expect(page.getByTestId('up-next-eyebrow')).toHaveText('Up next');
    await expect(page.getByTestId('up-next-title')).toHaveText('A major');
    await expect(page.getByTestId('up-next-body')).toHaveText(UP_NEXT);
    await expectStyle(page.getByTestId('up-next'), {
      backgroundColor: 'rgb(255, 244, 236)',
      borderTopColor: 'rgb(255, 210, 184)',
      borderTopLeftRadius: '20px',
      paddingTop: '20px',
      paddingLeft: '22px',
    });

    // ---- actions (Path:84–89) ----
    const cta = page.getByTestId('path-cta');
    await expect(cta).toHaveText('Start A major');
    await expectSize(cta, { height: 56 });
    await expectStyle(cta, { borderTopLeftRadius: '16px', boxShadow: SH_PRIMARY });
    const toggle = page.getByTestId('review-toggle');
    await expect(toggle).toHaveText('Review a finished key');
    await expectSize(toggle, { height: 56 });
    await expectStyle(toggle, {
      boxShadow: SH_CARD,
      borderTopColor: LINE_STRONG,
      borderTopLeftRadius: '16px',
    });

    // ---- circle (Path:94–128): positions within 1px of the design's hardcoded left/top ----
    const circle = page.getByTestId('circle');
    await expectSize(circle, { width: 580, height: 580 });
    const origin = await box(circle);
    const keys = circle.locator('[data-node="key"]');
    await expect(keys).toHaveCount(12);
    for (const [i, [label, left, top, size]] of DESIGN_KEYS.entries()) {
      const node = keys.nth(i);
      await expect(node).toHaveText(label);
      const b = await box(node);
      expect(Math.abs(b.x - origin.x - left), `${label} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y - origin.y - top), `${label} top`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.width - size), `${label} size`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(b.height - size), `${label} size`).toBeLessThanOrEqual(0.5);
    }
    const nodeStates = await keys.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-state')),
    );
    expect(nodeStates).toEqual([
      'done',
      'done',
      'done',
      'current',
      ...Array<string>(8).fill('upcoming'),
    ]);
    await expectStyle(keys.nth(0), { backgroundColor: TEAL, fontSize: '24px' });
    await expectStyle(keys.nth(3), { backgroundColor: TANGERINE, fontSize: '30px' });
    await expectStyle(keys.nth(4), { backgroundColor: PAPER, borderTopColor: LINE_STRONG });
    await expectStyle(keys.nth(6), { fontSize: '20px' }); // Path:110 G♭
    await expectStyle(keys.nth(7), { fontSize: '24px' }); // Path:111 D♭
    const minors = circle.locator('[data-node="minor"]');
    await expect(minors).toHaveCount(12);
    for (const [i, [label, left, top]] of DESIGN_MINORS.entries()) {
      const node = minors.nth(i);
      await expect(node).toHaveText(label);
      const b = await box(node);
      expect(Math.abs(b.x - origin.x - left), `${label} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y - origin.y - top), `${label} top`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.width - 40), `${label} size`).toBeLessThanOrEqual(0.5);
    }
    await expect(circle).toContainText('3/12');
    await expect(circle).toContainText('inner ring: relative minors');

    await page.screenshot({ path: 'e2e/screenshots/10-path.png' });

    // ---- Review a finished key lists done keys (ui.md §3) ----
    await expect(page.getByTestId('review-finished')).toHaveCount(0);
    await toggle.click();
    const review = page.getByTestId('review-finished');
    await expect(review.locator('button')).toHaveText(['C major', 'G major', 'D major']);
    await toggle.click();
    await expect(review).toHaveCount(0);

    // ---- clicking a done node starts a review session ----
    await keys.nth(0).click();
    await expect(page).toHaveURL(/#\/practice\/c-major\?session=[^&]+$/);
  } finally {
    await app.close();
  }
});

test('Path: "Review a finished key" card starts a review of the picked key', async () => {
  const { app, page } = await launchCadence();
  try {
    await seed(page, 'day8');
    await go(page, '/tracks/major-diatonic-chords');
    await page.getByTestId('review-toggle').click();
    await page.getByTestId('review-key-g-major').click();
    await expect(page).toHaveURL(/#\/practice\/g-major\?session=[^&]+$/);
  } finally {
    await app.close();
  }
});

test('Path: primary CTA starts the learn session; the library opens the map', async () => {
  const { app, page } = await launchCadence();
  try {
    await seed(page, 'day8');
    await go(page, '/tracks');
    await page.getByTestId('library-card-major-diatonic-chords').click();
    await expect(page).toHaveURL(/#\/tracks\/major-diatonic-chords$/);
    await page.getByTestId('path-cta').click();
    await expect(page).toHaveURL(/#\/practice\/a-major\?session=[^&]+$/);
  } finally {
    await app.close();
  }
});

test('dev screen /dev/screens/path renders the design fixture and the minor ready state', async () => {
  const { app, page } = await launchCadence();
  try {
    await go(page, '/dev/screens/path');
    await expect(page.getByTestId('up-next-body')).toHaveText(UP_NEXT);
    await go(page, '/dev/screens/path?track=minor');
    await expect(page.getByTestId('up-next-eyebrow')).toHaveText('Ready to start');
    await expect(page.getByTestId('circle')).toContainText('inner ring: relative majors');
  } finally {
    await app.close();
  }
});
