import { expect, test } from '@playwright/test';
import { go, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 07 — Today (Main.dc.html) over the real engine, plus first-run onboarding.

const LINE = 'rgb(239, 232, 223)'; // --line #EFE8DF
const SH_CARD = 'rgb(233, 224, 213) 0px 4px 0px 0px'; // --sh-card, Main:51
const SH_PRIMARY = 'rgb(196, 74, 27) 0px 5px 0px 0px'; // --sh-primary, Main:105
const GREETING = /^Good (morning|afternoon|evening), Harry\.$/;

test('Today (seed day8): blocks, CTA, probes, starts the learn session', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await expect(page.getByTestId('today')).toBeVisible();
    await expect(page.getByTestId('today-greeting')).toHaveText(GREETING);

    // ---- header pills from me.get (Main:29–35) ----
    await expect(page.getByTestId('streak-pill')).toHaveText('8 day streak');
    await expect(page.getByTestId('xp-pill')).toHaveText('1,240 XP');
    await expect(page.getByTestId('midi-pill')).toBeVisible();

    // ---- three blocks (Main:57–101; engine.md §4.T seed day8) ----
    const rows = page.getByTestId('block-row');
    await expect(rows).toHaveCount(3);
    const expected = [
      [
        'done',
        'Warm-up',
        'C major · all 7 diatonic chords',
        'You know this one. Played clean, no hints.',
      ],
      [
        'current',
        'Learn · new key',
        'A major · all 7 diatonic chords',
        'Next stop on the circle of fifths. Three sharps: F♯, C♯, G♯.',
      ],
      [
        'upcoming',
        'Review · due today',
        'G major · all 7 diatonic chords',
        "You needed a hint on vii° last time. Let's lock it in.",
      ],
    ] as const;
    for (const [i, [state, eyebrow, title, blurb]] of expected.entries()) {
      const row = rows.nth(i);
      await expect(row).toHaveAttribute('data-state', state);
      await expect(row).toContainText(eyebrow);
      await expect(row).toContainText(title);
      await expect(row).toContainText(blurb);
    }
    await expect(page.getByTestId('today-plan')).toContainText('3 blocks · ~10 min');

    const cta = page.getByTestId('today-cta');
    await expect(cta).toHaveText('Start A major');

    // ---- tracks (Main:113–165) ----
    await expect(page.getByTestId('track-card-major-diatonic-chords')).toContainText(
      '3 of 12 keys · C, G, D',
    );
    await expect(page.getByTestId('track-card-major-diatonic-chords')).toHaveAttribute(
      'href',
      '#/tracks/major-diatonic-chords',
    );
    // decisions.md 2026-10-08 "Track library": only joined tracks; the rest live in /tracks.
    await expect(page.getByTestId('track-card-minor-diatonic-chords')).toHaveCount(0);
    await expect(page.getByTestId('track-row-ear-training')).toContainText('Intervals · Level 3');

    // ---- fidelity probes (docs/ui.md §5) ----
    await expectStyle(page.getByTestId('app-header'), {
      height: '76px',
      borderBottom: `2px solid ${LINE}`,
    });
    await expectStyle(page.getByTestId('today-greeting'), {
      fontFamily: /Fredoka/,
      fontWeight: '600',
      fontSize: '44px',
    });
    await expectStyle(page.getByTestId('today-plan'), {
      borderTopLeftRadius: '24px',
      borderTopWidth: '2px',
      boxShadow: SH_CARD,
      paddingTop: '28px',
      paddingLeft: '32px',
    });
    await expectSize(cta, { height: 60 });
    await expectStyle(cta, {
      borderTopLeftRadius: '18px',
      boxShadow: SH_PRIMARY,
      fontSize: '19px',
      fontWeight: '800',
    });
    await expectStyle(page.getByTestId('track-card-major-diatonic-chords'), {
      borderTopLeftRadius: '20px',
      borderTopColor: 'rgb(255, 138, 76)',
      boxShadow: SH_CARD,
    });
    await expectSize(page.getByTestId('add-track'), { height: 48 });
    await expectStyle(page.getByTestId('add-track'), {
      borderTopStyle: 'dashed',
      borderTopColor: 'rgb(217, 207, 195)',
    });
    // Two columns at 1280 (Main:43): the tracks column sits to the right of the plan.
    const plan = await page.getByTestId('today-plan').boundingBox();
    const tracks = await page.getByTestId('track-card-major-diatonic-chords').boundingBox();
    expect(tracks && plan && tracks.x > plan.x + plan.width).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/07-today.png' });

    // ---- CTA starts the learn session and routes to Practice ----
    await cta.click();
    await expect(page).toHaveURL(/#\/practice\/a-major\?session=[^&]+$/);
  } finally {
    await app.close();
  }
});

test('Add something to learn opens the library; starting a track there joins it', async () => {
  const { app, page } = await launchCadence();
  try {
    await seed(page, 'day8');
    await page.getByTestId('add-track').click();
    await expect(page).toHaveURL(/#\/tracks$/);
    await page.getByTestId('library-card-major-scales').click();
    await expect(page).toHaveURL(/#\/tracks\/major-scales$/);
    await page.getByTestId('path-cta').click();
    await expect(page).toHaveURL(/#\/practice\/c-major-scale\?session=/);
    await expect(page.getByTestId('chord-name')).toHaveText('C major scale, going up');
    await go(page, '/');
    await expect(page.getByTestId('track-card-major-scales')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('dev screen /dev/screens/today renders the done knob', async () => {
  const { app, page } = await launchCadence();
  try {
    await go(page, '/dev/screens/today?done=3');
    await expect(page.getByTestId('today-extra')).toHaveText('Practice something extra');
    await expect(page.getByTestId('today-cta-note')).toHaveText('Day 8 streak kept');
    await go(page, '/dev/screens/today?done=0');
    await expect(page.getByTestId('today-cta')).toHaveText('Start C major');
  } finally {
    await app.close();
  }
});

test('first run: onboarding asks for a name, then lands on Today', async () => {
  const { app, page } = await launchCadence();
  try {
    await expect(page.getByTestId('onboarding')).toBeVisible();
    const submit = page.getByTestId('onboarding-submit');
    await expect(submit).toBeDisabled();
    await page.getByTestId('onboarding-name').fill('Harry');
    await submit.click();
    await expect(page.getByTestId('today-greeting')).toHaveText(GREETING);
    await expect(page.getByTestId('today-cta')).toBeVisible();
  } finally {
    await app.close();
  }
});
