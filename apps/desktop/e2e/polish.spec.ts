import { expect, test, type Page } from '@playwright/test';
import { go, invoke, seed } from './ipc';
import { launchCadence } from './launch';
import { expectSize, expectStyle } from './probes';

// Task 16 — Polish: MIDI device picker + hot-plug, the no-keyboard path, Today edge states,
// fully complete tracks, accessibility (names, tap targets, focus rings, keyboard, motion).
// Fake MIDI ports run through the real WebMidiInput (window.__cadenceDev.midi.fakeDevices), so
// these checks are deterministic whether or not a keyboard is plugged into the host.

interface Device {
  id: string;
  name: string;
}

type DevWindow = {
  __cadenceDev?: {
    midi: {
      fakeDevices(devices: Device[]): void;
      plug(device: Device): void;
      unplug(id: string): void;
      sendFrom(id: string, bytes: number[]): void;
      listening(): string[];
    };
  };
};

const INK = 'rgb(33, 27, 22)'; // --ink
const FP30: Device = { id: 'fp30x', name: 'Roland FP-30X' };
const KEYSTEP: Device = { id: 'keystep', name: 'Arturia KeyStep' };

async function fakeDevices(page: Page, devices: Device[]): Promise<void> {
  await page.evaluate((d) => {
    const midi = (window as unknown as DevWindow).__cadenceDev?.midi;
    if (!midi) throw new Error('window.__cadenceDev.midi missing');
    midi.fakeDevices(d);
  }, devices);
}

async function devMidi(
  page: Page,
  call: 'plug' | 'unplug' | 'sendFrom',
  ...args: unknown[]
): Promise<void> {
  await page.evaluate(
    ([c, a]) => {
      const midi = (window as unknown as DevWindow).__cadenceDev?.midi as unknown as Record<
        string,
        (...x: unknown[]) => void
      >;
      const fn = midi[c];
      if (!fn) throw new Error(`__cadenceDev.midi.${c} missing`);
      fn(...a);
    },
    [call, args] as const,
  );
}

const listening = (page: Page) =>
  page.evaluate(() => (window as unknown as DevWindow).__cadenceDev?.midi.listening() ?? []);

const keyState = (page: Page, midi: number) =>
  page.getByTestId('practice-keyboard').locator(`[data-midi="${midi}"]`);

/** Mark the current chord as played and wait for the next one (or the finish card). */
async function markPlayed(page: Page, i: number): Promise<void> {
  await expect(page.getByTestId('chord-no')).toHaveText(`Chord ${i + 1} of 7`);
  await page.getByTestId('mark-played').click();
  if (i < 6) {
    await expect(page.getByTestId('practice')).toHaveAttribute('data-current', String(i + 1));
  } else {
    await expect(page.getByTestId('practice-finished')).toBeVisible();
  }
}

test('MIDI picker: lists ports, switches input, persists across relaunch', async () => {
  const first = await launchCadence();
  const { page, userData } = first;
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await expect(page.getByTestId('today')).toBeVisible();
    await fakeDevices(page, [FP30, KEYSTEP]);

    const pill = page.getByTestId('app-header').getByTestId('midi-pill');
    await expect(pill).toHaveText('Roland FP-30X connected');
    await expect(pill).toHaveAttribute('aria-haspopup', 'menu');
    // The button keeps the design's pill metrics (40px + 2px border = a 44px tap target).
    await expectStyle(pill, { height: '40px', borderTopWidth: '2px', borderRadius: '999px' });
    await expectSize(pill, { height: 44 });

    await pill.click();
    const menu = page.getByTestId('midi-menu');
    const items = menu.getByRole('menuitemradio');
    await expect(items).toHaveText(['Roland FP-30X', 'Arturia KeyStep']);
    await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect(items.nth(0)).toBeFocused();
    await expectSize(items.nth(1), { height: 44 });
    await page.screenshot({ path: 'e2e/screenshots/16-midi-picker.png' });

    // Keyboard: ArrowDown + Enter picks the second port.
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(pill).toHaveText('Arturia KeyStep connected');
    await expect(pill).toBeFocused();
    expect(await listening(page)).toEqual([KEYSTEP.id]);
    await expect
      .poll(async () => (await invoke(page, 'me.get')).midi)
      .toEqual({ deviceId: KEYSTEP.id, deviceName: KEYSTEP.name });

    // Escape and outside clicks close the menu.
    await pill.click();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await pill.click();
    await page.getByTestId('today-greeting').click();
    await expect(menu).toHaveCount(0);
  } finally {
    await first.app.close();
  }

  // Relaunch over the same profile: the saved keyboard is chosen again (me.midi).
  const second = await launchCadence({ userData });
  try {
    await expect(second.page.getByTestId('today')).toBeVisible();
    await fakeDevices(second.page, [FP30, KEYSTEP]);
    await expect(second.page.getByTestId('app-header').getByTestId('midi-pill')).toHaveText(
      'Arturia KeyStep connected',
    );
    expect(await listening(second.page)).toEqual([KEYSTEP.id]);
  } finally {
    await second.app.close();
  }
});

test('no keyboard: unplug mid-session clears held notes; mark-as-played finishes A major', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    // Clicks "Finish the key" itself: hands-free auto-finish off (autocontinue.spec.ts).
    await seed(page, 'day8', { autoContinue: false });
    await expect(page.getByTestId('today')).toBeVisible();
    await fakeDevices(page, [FP30]);
    await go(page, '/practice/a-major');
    await expect(page.getByTestId('chord-no')).toHaveText('Chord 1 of 7');

    const pill = page.getByTestId('task-header').getByTestId('midi-pill');
    await expect(pill).toHaveText('Roland FP-30X');
    // engine.md §6.3: Mark as played is hidden while a keyboard is connected.
    await expect(page.getByTestId('mark-played')).toHaveCount(0);

    // Two notes of A major down on the real (fake) port, then the cable comes out.
    await devMidi(page, 'sendFrom', FP30.id, [0x90, 57, 100]);
    await devMidi(page, 'sendFrom', FP30.id, [0x90, 61, 100]);
    await expect(keyState(page, 57)).toHaveAttribute('data-state', 'held');
    await devMidi(page, 'unplug', FP30.id);
    await expect(pill).toHaveAttribute('data-status', 'no-device');
    await expect(pill).toHaveText('No keyboard found');
    await expect(keyState(page, 57)).toHaveAttribute('data-state', 'idle');
    await expect(keyState(page, 61)).toHaveAttribute('data-state', 'idle');
    await expect(page.getByTestId('mark-played')).toBeVisible();
    await expect(page.getByTestId('practice')).toHaveAttribute('data-current', '0');
    await page.screenshot({ path: 'e2e/screenshots/16-practice-no-midi.png' });

    // Plug back in: the pill reconnects and Mark as played steps aside again.
    await devMidi(page, 'plug', FP30);
    await expect(pill).toHaveText('Roland FP-30X');
    await expect(page.getByTestId('mark-played')).toHaveCount(0);

    // No keyboard at all: the whole key is playable with Mark as played.
    await fakeDevices(page, []);
    await expect(pill).toHaveText('No keyboard found');
    await pill.click();
    await expect(page.getByTestId('midi-menu-empty')).toContainText('Plug one in');
    await page.keyboard.press('Escape');
    for (let i = 0; i < 7; i++) await markPlayed(page, i);
    await page.getByTestId('finish-key').click();
    await expect(page).toHaveURL(/#\/complete\//);
    await expect(page.getByTestId('complete-title')).toContainText('A major');
  } finally {
    await app.close();
  }
});

test('abandoned session: leaving Practice mid-level offers "Resume G major" on Today', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await expect(page.getByTestId('today')).toBeVisible();
    await expect(page.getByTestId('today-resume')).toHaveCount(0);
    await fakeDevices(page, []);

    await go(page, '/practice/g-major');
    await markPlayed(page, 0);
    await markPlayed(page, 1);
    await expect(page).toHaveURL(/session=/);
    const sessionId = new URL(page.url().replace('#', '')).searchParams.get('session');
    await page.getByTestId('task-header').getByRole('link', { name: 'Today' }).click();

    const row = page.getByTestId('today-resume');
    await expect(row).toContainText('Left mid-way');
    await expect(row).toContainText('2 of 7 chords played');
    const link = page.getByTestId('today-resume-link');
    await expect(link).toHaveText('Resume G major');
    await expectSize(link, { height: 48 });
    // The CTA still starts today's learn block; the resume row sits below it.
    await expect(page.getByTestId('today-cta')).toHaveText(/A major/);
    await page.screenshot({ path: 'e2e/screenshots/16-today-resume.png' });

    await link.click();
    await expect(page).toHaveURL(new RegExp(`#/practice/g-major\\?session=${sessionId ?? ''}$`));
    await expect(page.getByTestId('chord-no')).toHaveText('Chord 3 of 7');
    const session = await invoke(page, 'sessions.get', { sessionId: sessionId ?? '' });
    expect(session.finishedAt).toBeNull();
    expect(session.results).toHaveLength(2);
  } finally {
    await app.close();
  }
});

test('Today with no active tracks: the CTA picks something to learn', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    // Pause both default tracks before today's plan is first built.
    await invoke(page, 'dev.seed', { scenario: 'first-run' });
    await invoke(page, 'tracks.setSettings', { trackId: 'major-diatonic-chords', active: false });
    await invoke(page, 'tracks.setSettings', { trackId: 'ear-training', active: false });
    await page.reload();

    await expect(page.getByTestId('today')).toBeVisible();
    await expect(page.getByTestId('today-plan')).toHaveCount(0);
    await expect(page.getByText('You’re not learning anything right now.')).toBeVisible();
    const cta = page.getByTestId('today-cta');
    await expect(cta).toHaveText('Pick something to learn');
    await expect(page.getByTestId('today-cta-note')).toHaveCount(0);
    await page.screenshot({ path: 'e2e/screenshots/16-today-no-tracks.png' });
    await cta.click();
    await expect(page.getByTestId('library')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('all complete: Today, the circle and the ear ladder show finished states', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'all-complete');
    await expect(page.getByTestId('today')).toBeVisible();
    await expect(page.getByTestId('today-greeting')).toBeVisible();
    await expect(page.getByTestId('today-cta')).toBeVisible();
    await expect(page.getByTestId('track-card-major-diatonic-chords')).toContainText('Complete');
    await expect(page.getByTestId('track-row-ear-training')).toContainText('Complete');
    await page.screenshot({ path: 'e2e/screenshots/16-today-all-complete.png' });

    await go(page, '/tracks/major-diatonic-chords');
    await expect(page.getByTestId('up-next-eyebrow')).toHaveText('Complete');
    await expect(page.getByTestId('up-next-title')).toHaveText('Every key done');
    await expect(page.getByTestId('path-cta')).toHaveCount(0);
    await expect(page.locator('[data-node="key"][data-state="done"]')).toHaveCount(12);
    await page.screenshot({ path: 'e2e/screenshots/16-path-complete.png' });

    await go(page, '/tracks/ear-training');
    await expect(page.getByTestId('ladder-complete')).toContainText('Every level done');
    await expect(page.getByTestId('ladder-start')).toHaveCount(0);
    await expect(page.getByTestId('stage-row')).toHaveCount(5);
    for (const state of await page
      .getByTestId('stage-row')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))) {
      expect(state).toBe('done');
    }
    await expect(page.getByTestId('ladder-eyebrow')).toHaveText('Track · stage 5 of 5');
    await page.screenshot({ path: 'e2e/screenshots/16-earpath-complete.png' });
  } finally {
    await app.close();
  }
});

/** Visible interactive elements without an accessible name, or (buttons) shorter than 44px. */
async function a11yOffenders(page: Page): Promise<{ unnamed: string[]; small: string[] }> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const nameOf = (el: Element): string => {
      const label = el.getAttribute('aria-label');
      if (label) return label;
      const by = el.getAttribute('aria-labelledby');
      if (by)
        return by
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
      return (el.textContent ?? '').trim();
    };
    const brief = (el: Element) => el.outerHTML.slice(0, 120);
    const interactive = [
      ...document.querySelectorAll('button, a[href], input, [role="button"], [role^="menuitem"]'),
    ].filter(visible);
    return {
      unnamed: interactive.filter((el) => nameOf(el).trim() === '').map(brief),
      small: interactive
        .filter((el) => el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')
        .filter((el) => el.getBoundingClientRect().height < 43.5)
        .map(brief),
    };
  });
}

test('accessibility: names, 44px buttons, focus rings, keyboard nodes, reduced motion', async () => {
  const { app, page } = await launchCadence();
  try {
    await page.setViewportSize({ width: 1280, height: 820 });
    await seed(page, 'day8');
    await expect(page.getByTestId('today')).toBeVisible();

    const routes: ReadonlyArray<readonly [string, string]> = [
      ['/', 'today'],
      ['/tracks/major-diatonic-chords', 'path'],
      ['/tracks/ear-training', 'ladder-path'],
      ['/tracks/minor-diatonic-chords/lesson', 'learn'],
      ['/practice/a-major', 'practice'],
      ['/dev/screens/ear-interval', 'ear-drill'],
      ['/dev/screens/ear-key', 'key-drill'],
    ];
    for (const [route, testId] of routes) {
      await go(page, route);
      await expect(page.getByTestId(testId).first()).toBeVisible();
      expect(await a11yOffenders(page), route).toEqual({ unnamed: [], small: [] });
    }

    // ShowMeControl segments are 44px (decisions.md, Task 16; the design has 36).
    await go(page, '/practice/a-major');
    const seg = page.getByTestId('show-me').getByRole('button', { name: 'Chord names' });
    await expectSize(seg, { height: 44 });
    await seg.focus();
    await page.keyboard.press('Space');
    await expect(seg).toHaveAttribute('aria-pressed', 'true');
    await expectStyle(seg, {
      outlineStyle: 'solid',
      outlineWidth: '2px',
      outlineColor: INK,
      outlineOffset: '2px',
    });

    // Focus rings: tab through Today; every stop shows the 2px ink ring at offset 2.
    await go(page, '/');
    await expect(page.getByTestId('today-cta')).toBeVisible();
    await page.getByTestId('today-greeting').click();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          el: el.outerHTML.slice(0, 80),
          ring: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`,
        };
      });
      expect(ring?.ring, ring?.el).toBe(`solid 2px ${INK} 2px`);
    }

    // Circle nodes are real buttons: Enter on a done key starts its review session.
    await go(page, '/tracks/major-diatonic-chords');
    const node = page.locator('[data-node="key"][data-state="done"]').first();
    await node.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/practice\/[a-z-]+\?session=/);

    // prefers-reduced-motion: the pulsing dots stop.
    // The dev screen's fixture pill is a static <div> (the live Practice pill is a <button>), so
    // this waits for the route change instead of reading the previous page.
    await go(page, '/dev/screens/practice');
    const dot = page.locator('div[data-testid="midi-pill"] span[aria-hidden="true"]').first();
    await expect(dot).toHaveCSS('animation-name', 'cad-pulse');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dot).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  } finally {
    await app.close();
  }
});
