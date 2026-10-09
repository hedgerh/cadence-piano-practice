import { expect, test } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 11 — EarPath (ladder track map) over the real engine (seed day8: Intervals L1–L2 passed).

const TEAL = 'rgb(91, 214, 184)'; // --teal, EarPath:94
const TANGERINE = 'rgb(255, 138, 76)'; // --tangerine, EarPath:96
const SAND_DEEP = 'rgb(237, 229, 219)'; // --sand-deep, EarPath:97
const LINE_STRONG = 'rgb(230, 222, 212)'; // --line-strong, EarPath:85
const LAVENDER = 'rgb(205, 191, 255)'; // --lavender, EarPath:68
const LAVENDER_TINT = 'rgb(243, 239, 255)'; // --lavender-tint, EarPath:68

test('EarPath (seed day8): stages, unlock copy, probes, starts Level 3', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await go(page, '/tracks/ear-training');
    await expect(page.getByTestId('ladder-path')).toBeVisible();

    // ---- header + pills (EarPath:20–47) ----
    await expect(
      page.getByTestId('app-header').getByRole('link', { name: 'Tracks' }),
    ).toHaveAttribute('aria-current', 'page');
    const pills = page.getByTestId('track-pills');
    await expect(pills.locator('[data-state="active"]')).toHaveText('Ear training');
    // decisions.md 2026-10-08 "Track library": the row holds the Ear training group only.
    await expect(pills.locator('[data-state]')).toHaveCount(1);
    await expect(page.getByTestId('all-tracks-link')).toHaveAttribute('href', '#/tracks');

    // ---- intro + cards (EarPath:52–77) ----
    await expect(page.getByTestId('ladder-eyebrow')).toHaveText('Track · stage 1 of 5');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ear training');
    await expect(page.getByTestId('ladder-how')).toContainText('How a level works');
    await expect(page.getByTestId('ladder-how').locator('li')).toHaveCount(4);
    const upNext = page.getByTestId('ladder-up-next');
    await expect(upNext).toContainText('Up next');
    await expect(upNext).toContainText('Intervals · Level 3');
    await expect(upNext).toContainText('Adds the perfect 4th and major 2nd');
    await expectStyle(upNext, {
      backgroundColor: LAVENDER_TINT,
      borderTopColor: LAVENDER,
      borderTopLeftRadius: '20px',
    });
    const start = page.getByTestId('ladder-start');
    await expect(start).toHaveText('Start Level 3');
    await expectSize(start, { height: 56 });
    // Task 16: the CTA (and its 5px shadow) is above the fold at 1280×820; Show me sits below it.
    const startBox = await start.boundingBox();
    expect(startBox && startBox.y + startBox.height + 5).toBeLessThanOrEqual(820);
    const showMeBox = await page.getByTestId('ladder-show-me').boundingBox();
    expect(showMeBox && startBox && showMeBox.y > startBox.y + startBox.height).toBe(true);

    // ---- stages from the engine (EarPath:82–157; engine.md §6.9 unlock copy) ----
    const rows = page.getByTestId('stage-row');
    await expect(rows).toHaveCount(5);
    const expected = [
      ['current', 'Intervals', 'Level 3 of 6'],
      ['locked', 'Scale degrees', 'Unlocks at Intervals L4'],
      ['locked', 'Chord quality', 'Unlocks at Intervals L5'],
      ['locked', 'Chords in a key', 'Unlocks after Scale degrees L3'],
      ['locked', 'Find the key', 'Unlocks after Chords in a key L2'],
    ] as const;
    for (const [i, [state, title, meta]] of expected.entries()) {
      const row = rows.nth(i);
      await expect(row).toHaveAttribute('data-state', state);
      const head = row.locator(':scope > :nth-child(2) > :first-child > span');
      await expect(head).toHaveText([title, meta]);
    }

    // Current card: 2 teal + 1 tangerine + 3 grey segments (EarPath:93–100).
    const current = rows.nth(0);
    const segs = current.locator('span[data-state]');
    await expect(segs).toHaveCount(6);
    const colors = await segs.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundColor),
    );
    expect(colors).toEqual([TEAL, TEAL, TANGERINE, SAND_DEEP, SAND_DEEP, SAND_DEEP]);
    for (let i = 1; i < 5; i++)
      await expect(rows.nth(i).locator('span[data-state]')).toHaveCount(0);

    // ---- fidelity probes: node 48px, rail 3px line-strong, card radius 18 ----
    const node = current.locator(':scope > :first-child > :first-child');
    await expectSize(node, { width: 48, height: 48 });
    await expectStyle(node, { backgroundColor: TANGERINE, borderTopLeftRadius: '50%' });
    const rail = current.locator(':scope > :first-child > :nth-child(2)');
    await expectStyle(rail, { width: '3px', backgroundColor: LINE_STRONG });
    const card = current.locator(':scope > :nth-child(2)');
    await expectStyle(card, {
      borderTopLeftRadius: '18px',
      borderTopColor: TANGERINE,
      paddingTop: '16px',
      paddingLeft: '20px',
    });
    const lockedNode = rows.nth(1).locator(':scope > :first-child > :first-child');
    await expectSize(lockedNode, { width: 48, height: 48 });
    // 3px border (EarPath:106); Chromium snaps border widths to device pixels on 1.5x displays.
    await expectStyle(lockedNode, {
      borderTopWidth: /^(3|2\.6+7)px$/,
      borderTopColor: LINE_STRONG,
    });
    await expectStyle(rows.nth(1).locator(':scope > :nth-child(2)'), {
      borderTopLeftRadius: '18px',
    });
    // Last stage has no rail below its node (EarPath:147–149).
    await expect(rows.nth(4).locator(':scope > :first-child > *')).toHaveCount(1);

    // Two columns at 1280 (EarPath:49), aligned to the top.
    const info = await page.getByTestId('ladder-how').boundingBox();
    const stages = await page.getByTestId('ladder-stages').boundingBox();
    expect(info && stages && stages.x > info.x + info.width).toBe(true);
    await expectStyle(page.getByTestId('ladder-stages').locator('xpath=..'), {
      alignItems: 'start',
    });

    await page.screenshot({ path: 'e2e/screenshots/11-earpath.png' });

    // ---- Show me sets the ear track's visibility (decisions.md, Task 11) ----
    const showMe = page.getByTestId('ladder-show-me');
    // decisions.md (Task 16): segments are 44px tap targets (the design's 36px, raised).
    await expectSize(showMe.getByRole('button', { name: 'Numerals only' }), { height: 44 });
    await showMe.getByRole('button', { name: 'Numerals only' }).click();
    await expect(showMe.getByRole('button', { name: 'Numerals only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const overview = await invoke(page, 'tracks.overview', { trackId: 'ear-training' });
    expect(overview.visibility).toBe('num');
    await showMe.getByRole('button', { name: 'All 7 chords' }).click();
    await expect(showMe.getByRole('button', { name: 'All 7 chords' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // ---- Replay a passed level (decisions.md "Ear level replay"): a review session ----
    const intervals = overview.stages?.[0];
    const l2 = intervals?.levels[1]?.levelId ?? '';
    expect(intervals?.levels.slice(0, 2).map((l) => l.state)).toEqual(['done', 'done']);
    const replaySegs = current.getByRole('button', { name: /^Replay Level/ });
    await expect(replaySegs).toHaveCount(2);
    // The visible bar stays 10px; the button is a 44px tap target.
    await expectSize(replaySegs.nth(1), { height: 44 });
    await expectStyle(replaySegs.nth(1).locator('span'), { height: '10px' });
    const toggle = page.getByTestId('replay-toggle-intervals');
    await expect(page.getByRole('button', { name: 'Replay a level' })).toHaveCount(1);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const list = page.getByTestId('replay-list-intervals');
    await expect(list.getByRole('button')).toHaveCount(2);
    await expect(list.getByRole('button')).toHaveText([
      /^Level 1 · Unison, perfect 5th and octave/,
      /^Level 2 · Adds the major and minor 3rd/,
    ]);
    // ≥ 44px: a pill grows if its blurb wraps in the stage column.
    for (const pill of await list.getByRole('button').all()) {
      expect((await pill.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: 'e2e/screenshots/11-earpath-replay.png' });

    await current.getByRole('button', { name: 'Replay Level 2' }).click();
    await expect(page).toHaveURL(new RegExp(`#/ear/${l2}\\?session=[^&]+$`));
    const replayId = /session=([^&]+)$/.exec(page.url())?.[1] ?? '';
    const replay = await invoke(page, 'sessions.get', { sessionId: replayId });
    expect(replay).toMatchObject({ levelId: l2, kind: 'review' });

    // The current level does not move.
    await go(page, '/tracks/ear-training');
    await expect(rows.nth(0).locator(':scope > :nth-child(2) > :first-child > span')).toHaveText([
      'Intervals',
      'Level 3 of 6',
    ]);
    await expect(start).toHaveText('Start Level 3');
    expect(
      (await invoke(page, 'tracks.overview', { trackId: 'ear-training' })).upNext?.levelId,
    ).toBe(overview.upNext?.levelId);

    // ---- Start Level 3 → sessions.start → /ear/:levelId?session= ----
    const levelId = overview.upNext?.levelId ?? '';
    expect(levelId).not.toBe('');
    await start.click();
    await expect(page).toHaveURL(new RegExp(`#/ear/${levelId}\\?session=[^&]+$`));
  } finally {
    await app.close();
  }
});

test('dev screen /dev/screens/ear-path renders the fixture ladder', async () => {
  const { app, page } = await launchCadence();
  try {
    await go(page, '/dev/screens/ear-path');
    await expect(page.getByTestId('stage-row')).toHaveCount(5);
    await expect(page.getByTestId('ladder-start')).toHaveText('Start Level 3');
    await expect(page.getByRole('button', { name: /^Replay Level/ })).toHaveCount(2);
    await go(page, '/dev/screens/ear-path?replay=intervals');
    await expect(page.getByTestId('replay-list-intervals').getByRole('button')).toHaveCount(2);
    await go(page, '/dev/screens/ear-path?stage1=done');
    await expect(page.getByTestId('stage-row').first()).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('stage-row').first()).toContainText('Complete');
    await expect(page.getByTestId('replay-toggle-intervals')).toBeVisible();
    await page.getByTestId('replay-toggle-intervals').click();
    await expect(page.getByTestId('replay-list-intervals').getByRole('button')).toHaveCount(6);
  } finally {
    await app.close();
  }
});
