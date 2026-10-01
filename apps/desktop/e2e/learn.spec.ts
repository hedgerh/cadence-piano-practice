import { expect, test, type Page } from '@playwright/test';
import { go, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 10 — the minor track: "Ready to start" on Path → enroll → Learn (Learn.dc.html) first
// because lessonSeen is false → a-minor Practice; the second entry skips the lesson.

const INK_RING = 'rgb(33, 27, 22) 0px 0px 0px 3px'; // --ring-ink-3, Learn:49
const TANGERINE = 'rgb(255, 138, 76)';
const TEAL = 'rgb(91, 214, 184)';
const LAVENDER = 'rgb(205, 191, 255)';
const SH_CARD = 'rgb(233, 224, 213) 0px 4px 0px 0px';
const MINOR = 'minor-diatonic-chords';

async function stripNumerals(page: Page): Promise<string[]> {
  await expect(page.getByTestId('practice-strip')).toBeVisible();
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(
      (await page.getByTestId(`strip-chip-${i}`).locator('span').first().textContent()) ?? '',
    );
  }
  return out;
}

test('minor track: enroll from Path → lesson → a-minor practice; lesson gating runs once', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');

    // ---- Path: not enrolled → "Ready to start" (engine.md §6.15) ----
    await go(page, `/tracks/${MINOR}`);
    await expect(page.getByTestId('path')).toBeVisible();
    await expect(page.getByTestId('path-title')).toHaveText('Minor diatonic chords');
    await expect(page.getByTestId('up-next-eyebrow')).toHaveText('Ready to start');
    await expect(page.getByTestId('up-next-title')).toHaveText('A minor');
    await expect(page.getByTestId('up-next-note')).toHaveText('Starts with a 1-min lesson');
    // Minor track circle: outer ring minor keys, inner ring relative majors.
    const circle = page.getByTestId('circle');
    await expect(circle.locator('[data-node="key"]').first()).toHaveText('Am');
    await expect(circle.locator('[data-node="key"]').nth(6)).toHaveText('E♭m');
    await expect(circle.locator('[data-node="minor"]').first()).toHaveText('C');
    await expect(circle.locator('[data-node="minor"]').nth(6)).toHaveText('G♭');
    await expect(circle).toContainText('inner ring: relative majors');
    await expect(page.getByTestId('pattern-chip-0')).toHaveText('i');
    await expect(page.getByTestId('review-toggle')).toHaveCount(0);

    const cta = page.getByTestId('path-cta');
    await expect(cta).toHaveText('Start with the lesson');
    await cta.click();

    // ---- Learn (Learn.dc.html) ----
    await expect(page).toHaveURL(new RegExp(`#/tracks/${MINOR}/lesson$`));
    await expect(page.getByTestId('learn')).toBeVisible();
    await expect(page.getByTestId('task-header')).toContainText('Lesson · about 1 minute');
    await expectStyle(page.getByTestId('task-header'), { height: '76px' });
    await expect(page.getByTestId('learn-title')).toHaveText('The minor pattern');
    await expectStyle(page.getByTestId('learn-title'), { fontSize: '44px', fontFamily: /Fredoka/ });

    const row0 = page.getByTestId('lesson-chips-0').locator('> span');
    const row1 = page.getByTestId('lesson-chips-1').locator('> span');
    await expect(row0).toHaveText(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    await expect(row1).toHaveText(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
    await expect(page.getByTestId('lesson-row-0')).toContainText(
      'C major: C · Dm · Em · F · G · Am · B°',
    );
    await expect(page.getByTestId('lesson-row-1')).toContainText(
      'A minor: Am · B° · C · Dm · Em · F · G',
    );
    // Learn:44–50, 65–71 — h52 r12, quality fills, pivot rings on vi and i.
    await expectSize(row0.nth(0), { height: 52 });
    await expectStyle(row0.nth(0), {
      backgroundColor: TANGERINE,
      borderTopLeftRadius: '12px',
    });
    await expectStyle(row0.nth(5), { backgroundColor: TEAL, boxShadow: INK_RING });
    await expectStyle(row0.nth(6), { backgroundColor: LAVENDER, boxShadow: 'none' });
    await expectStyle(row1.nth(0), { backgroundColor: TEAL, boxShadow: INK_RING });
    await expectStyle(row1.nth(1), { backgroundColor: LAVENDER });
    await expectStyle(row0.nth(0).locator('span').first(), { fontSize: '22px' });
    // Learn:54–56 — bridge callout with **vi** bold.
    await expect(page.getByTestId('callout').locator('strong')).toHaveText('vi');
    await expectStyle(page.getByTestId('callout'), {
      backgroundColor: 'rgb(250, 247, 242)',
      borderTopLeftRadius: '14px',
    });
    // Learn:36 card; Learn:76 legend swatches 12px r4.
    await expectStyle(page.getByTestId('lesson-card'), {
      borderTopLeftRadius: '24px',
      boxShadow: SH_CARD,
      paddingTop: '26px',
      paddingLeft: '30px',
    });
    const swatch = page.getByTestId('lesson-card').locator('span[style*="background"]').last();
    await expectSize(swatch, { width: 12, height: 12 });
    await expectStyle(swatch, { borderTopLeftRadius: '4px' });

    const learnCta = page.getByTestId('learn-cta');
    const hear = page.getByTestId('learn-hear');
    await expect(learnCta).toHaveText('Got it — play A minor');
    await expect(hear).toHaveText('Hear both patterns');
    await expectSize(hear, { height: 56 });
    await expectStyle(hear, { boxShadow: SH_CARD });
    await page.screenshot({ path: 'e2e/screenshots/10-learn.png' });

    // ---- "Hear both patterns" disables while the 14 triads play ----
    await expect(hear).toBeEnabled();
    await hear.click();
    await expect(hear).toBeDisabled();
    await expect(page.getByTestId('lesson-chips-0')).toHaveAttribute('data-sounding', /\d/);

    // ---- CTA → tracks.lessonSeen → sessions.start → Practice ----
    await learnCta.click();
    await expect(page).toHaveURL(/#\/practice\/a-minor\?session=[^&]+$/);
    expect(await stripNumerals(page)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);

    // ---- second entry: the lesson is skipped ----
    await go(page, `/tracks/${MINOR}`);
    await expect(page.getByTestId('up-next-eyebrow')).toHaveText('Up next');
    await expect(page.getByTestId('up-next-note')).toHaveCount(0);
    await expect(page.getByTestId('path-cta')).toHaveText('Start A minor');
    await page.getByTestId('path-cta').click();
    await expect(page).toHaveURL(/#\/practice\/a-minor\?session=[^&]+$/);
  } finally {
    await app.close();
  }
});

test('dev screen /dev/screens/learn highlights the sounding chip', async () => {
  const { app, page } = await launchCadence();
  try {
    await go(page, '/dev/screens/learn?sounding=9');
    await expect(page.getByTestId('lesson-chips-1')).toHaveAttribute('data-sounding', '2');
    await expect(page.getByTestId('learn-hear')).toBeDisabled();
  } finally {
    await app.close();
  }
});
