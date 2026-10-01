import { expect, test, type Page } from '@playwright/test';
import { launchCadence } from './launch';
import { box, expectSize, expectStyle } from './probes';

// Task 06 — /dev/components fidelity probes (docs/ui.md §5).

type DevWindow = {
  __cadenceDev?: { midi: { press(m: number): void; release(m: number): void; held(): number[] } };
};

const LINE = 'rgb(239, 232, 223)'; // --line #EFE8DF

// Path.dc.html:104–115 (left, top, size) and 117–128 (minors, 40px).
const CIRCLE_KEYS: ReadonlyArray<readonly [number, number, number]> = [
  [254, 22, 72],
  [370, 53, 72],
  [455, 138, 72],
  [480, 248, 84],
  [455, 370, 72],
  [370, 455, 72],
  [254, 486, 72],
  [138, 455, 72],
  [53, 370, 72],
  [22, 254, 72],
  [53, 138, 72],
  [138, 53, 72],
];
const CIRCLE_MINORS: ReadonlyArray<readonly [number, number]> = [
  [270, 120],
  [345, 140],
  [400, 195],
  [420, 270],
  [400, 345],
  [345, 400],
  [270, 420],
  [195, 400],
  [140, 345],
  [120, 270],
  [140, 195],
  [195, 140],
];
const BLACK_LEFTS = [34.5, 81.5, 175.5, 222.5, 269.5, 363.5, 410.5, 504.5, 551.5, 598.5];

async function keyState(page: Page, keyboard: string, midi: number): Promise<string | null> {
  return page.getByTestId(keyboard).locator(`[data-midi="${midi}"]`).getAttribute('data-state');
}

test('component gallery: probes, MIDI input, offline fonts, no console errors', async () => {
  const { app, page } = await launchCadence();
  const errors: string[] = [];
  const networkFonts: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const url = r.url();
    const isFont = r.resourceType() === 'font' || /\.(woff2?|ttf|otf)(\?|$)|fonts\.g/.test(url);
    if (isFont && /^https?:/.test(url)) networkFonts.push(url);
  });

  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    // Reload onto the gallery so the listeners above see the whole boot.
    await page.evaluate(() => {
      window.location.hash = '#/dev/components';
    });
    await page.reload();
    await expect(page.getByTestId('dev-components')).toBeVisible();

    // ---- AppHeader (Main:20–41) ----
    const header = page.getByTestId('g-app-header-today').getByTestId('app-header');
    await expectStyle(header, {
      height: '76px',
      borderBottom: `2px solid ${LINE}`,
      paddingLeft: '48px',
      paddingRight: '48px',
    });
    await expectStyle(header.getByTestId('wordmark'), {
      fontFamily: /Fredoka/,
      fontWeight: '700',
      fontSize: '28px',
      letterSpacing: '-0.5px',
    });
    for (const pill of ['streak-pill', 'xp-pill', 'midi-pill']) {
      await expectStyle(header.getByTestId(pill), { height: '40px', borderRadius: '999px' }, pill);
    }
    await expectStyle(page.getByTestId('g-midi-pill-connected').getByTestId('midi-pill'), {
      height: '40px',
      borderTop: `2px solid ${LINE}`,
      fontSize: '14px',
    });

    // ---- Buttons and cards ----
    await expectStyle(page.getByTestId('g-primary-60').locator('button'), {
      height: '60px',
      borderTopLeftRadius: '18px',
      boxShadow: 'rgb(196, 74, 27) 0px 5px 0px 0px',
    });
    await expectStyle(page.getByTestId('g-primary-56').locator('button'), {
      height: '56px',
      borderTopLeftRadius: '16px',
    });
    await expectStyle(page.getByTestId('g-card-default').locator(':scope > div > div'), {
      borderTopLeftRadius: '24px',
      boxShadow: 'rgb(233, 224, 213) 0px 4px 0px 0px',
      borderTop: `2px solid ${LINE}`,
    });
    await expectStyle(page.getByTestId('g-segments-420').locator('[data-state]').first(), {
      height: '10px',
      backgroundColor: 'rgb(91, 214, 184)',
    });

    // ---- PianoKeyboard (Practice:90, 163, 170; EarInterval:81, 171, 175) ----
    const two = page.getByTestId('keyboard-two');
    await expectSize(two, { width: 661 });
    await expectSize(two.locator('[data-key="white"]').first(), { width: 44, height: 150 });
    await expectSize(two.locator('[data-key="black"]').first(), { width: 28, height: 95 });
    const lefts = await two
      .locator('[data-key="black"]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).left));
    expect(lefts).toEqual(BLACK_LEFTS.map((l) => `${l}px`));
    await expectStyle(two, {
      borderTopLeftRadius: '10px',
      boxShadow: 'rgb(217, 207, 195) 0px 6px 0px 0px',
    });

    const one = page.getByTestId('keyboard-one');
    await expectSize(one, { width: 332 });
    await expectSize(one.locator('[data-key="white"]').first(), { width: 44, height: 120 });
    await expectSize(one.locator('[data-key="black"]').first(), { width: 28, height: 76 });
    await expectStyle(one, { borderTopLeftRadius: '8px', boxShadow: 'none' });

    // ---- CircleOfFifths (Path:94–129): sizes 72/84/40, positions within 1px ----
    const circle = page.getByTestId('circle');
    const origin = await box(circle);
    const keys = circle.locator('[data-node="key"]');
    await expect(keys).toHaveCount(12);
    for (const [i, [left, top, size]] of CIRCLE_KEYS.entries()) {
      const b = await box(keys.nth(i));
      expect(Math.abs(b.x - origin.x - left), `key ${i} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y - origin.y - top), `key ${i} top`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.width - size), `key ${i} size`).toBeLessThanOrEqual(0.5);
    }
    const minors = circle.locator('[data-node="minor"]');
    await expect(minors).toHaveCount(12);
    for (const [i, [left, top]] of CIRCLE_MINORS.entries()) {
      const b = await box(minors.nth(i));
      expect(Math.abs(b.x - origin.x - left), `minor ${i} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y - origin.y - top), `minor ${i} top`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.width - 40), `minor ${i} size`).toBeLessThanOrEqual(0.5);
    }

    // ---- MIDI: pill status, computer keyboard, dev hooks ----
    const livePill = page.getByTestId('g-midi-pill-live').getByTestId('midi-pill');
    await expect(livePill).toHaveAttribute('data-status', /^(no-device|connected)$/);
    if ((await livePill.getAttribute('data-status')) === 'no-device') {
      await expect(livePill).toHaveText('No keyboard found');
    }

    // ui.md §4 mapping: a = C4, d = E4, g = G4.
    await page.getByTestId('dev-components').locator('h1').click();
    for (const k of ['a', 'd', 'g']) await page.keyboard.down(k);
    for (const m of [60, 64, 67]) expect(await keyState(page, 'keyboard-live', m)).toBe('held');
    expect(await keyState(page, 'keyboard-live', 62)).toBe('idle');
    for (const k of ['a', 'd', 'g']) await page.keyboard.up(k);
    await expect(page.getByTestId('keyboard-live').locator('[data-state="held"]')).toHaveCount(0);

    await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.press(61));
    await expect(page.getByTestId('keyboard-live').locator('[data-midi="61"]')).toHaveAttribute(
      'data-state',
      'held',
    );
    await expectStyle(page.getByTestId('keyboard-live').locator('[data-midi="61"]'), {
      backgroundColor: 'rgb(255, 213, 95)',
      boxShadow: 'rgb(33, 27, 22) 0px 0px 0px 3px inset',
    });
    await page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.release(61));
    await expect(page.getByTestId('keyboard-live').locator('[data-state="held"]')).toHaveCount(0);

    // ---- Fonts are bundled ----
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded: string[] = [];
      document.fonts.forEach((f) => {
        if (f.status === 'loaded') loaded.push(f.family);
      });
      return loaded.join(' ');
    });
    expect(families).toMatch(/Fredoka/);
    expect(families).toMatch(/Nunito/);
    expect(networkFonts).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'e2e/screenshots/06-components.png' });

    // ---- Screen registry: registered screens render (Task 08 practice); others fall back ----
    await page.evaluate(() => {
      window.location.hash = '#/dev/screens/practice';
    });
    await expect(page.getByTestId('practice')).toBeVisible();
    await page.evaluate(() => {
      window.location.hash = '#/dev/screens/not-a-screen';
    });
    await expect(page.getByTestId('dev-screens')).toBeVisible();
    await expect(page.getByTestId('dev-screens')).toContainText('Unknown screen');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
