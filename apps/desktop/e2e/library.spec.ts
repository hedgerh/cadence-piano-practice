import { expect, test } from '@playwright/test';
import { go, seed } from './ipc';
import { launchCadence } from './launch';

// decisions.md 2026-10-08 "Track library": /tracks lists every track by content group; a
// track's map shows that group's pills behind an "All tracks" link.

test('library: grouped sections, cards open maps, group pills lead back', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');

    // Header "Tracks" opens the library.
    await page.getByTestId('app-header').getByRole('link', { name: 'Tracks' }).click();
    await expect(page).toHaveURL(/#\/tracks$/);
    await expect(page.getByTestId('library')).toBeVisible();
    await expect(page.getByTestId('library-section').getByRole('heading')).toHaveText([
      'Chords',
      'Voice leading',
      'Scales',
      'Ear training',
    ]);

    const major = page.getByTestId('library-card-major-diatonic-chords');
    await expect(major).toContainText('In progress');
    await expect(major).toContainText('3 of 12 keys · C, G, D');
    await expect(major).toContainText('In your daily plan');
    await expect(page.getByTestId('library-card-major-scales')).toContainText('Ready to start');
    await expect(page.getByTestId('library-card-major-scales')).not.toContainText(
      'In your daily plan',
    );
    // decisions.md 2026-10-10 "Voice leading": the Voice leading section, every track ready.
    await expect(page.getByTestId('library-card-smooth-progressions')).toContainText(
      'Ready to start',
    );
    await expect(page.getByText('Coming soon')).toHaveCount(0);
    await page.screenshot({ path: 'e2e/screenshots/19-library.png' });

    // Major scales: its map, with only the Scales pills.
    await page.getByTestId('library-card-major-scales').click();
    await expect(page).toHaveURL(/#\/tracks\/major-scales$/);
    await expect(page.getByTestId('path-title')).toHaveText('Major scales');
    await expect(page.getByTestId('track-pills').locator('[data-state]')).toHaveText([
      'Major scales',
      'Minor scales',
    ]);
    await expect(page.getByTestId('path-cta')).toHaveText(/C major/);
    await page.screenshot({ path: 'e2e/screenshots/19-major-scales-path.png' });

    await page.getByTestId('all-tracks-link').click();
    await expect(page).toHaveURL(/#\/tracks$/);

    // An unknown track id falls back to the library.
    await go(page, '/tracks/nope');
    await expect(page).toHaveURL(/#\/tracks$/);

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('dev screen /dev/screens/library renders every content track', async () => {
  const { app, page } = await launchCadence();
  try {
    await go(page, '/dev/screens/library');
    await expect(
      page.locator('[data-testid^="library-card-"][data-testid$="-scales"]'),
    ).toHaveCount(2);
    await go(page, '/dev/screens/library?loading=1');
    await expect(page.getByTestId('library-section')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
