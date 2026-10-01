import type { Page } from '@playwright/test';
import type { Channel, ChannelInput, ChannelOutput } from '../src/shared/ipc/contracts';

type Bridge = { cadence: { invoke(channel: string, payload: unknown): Promise<unknown> } };

/** Calls main through the real preload bridge (window.cadence.invoke), exactly as lib/api.ts does. */
export async function invoke<C extends Channel>(
  page: Page,
  channel: C,
  input?: ChannelInput<C>,
): Promise<ChannelOutput<C>> {
  const result = await page.evaluate(
    ([c, i]) => (window as unknown as Bridge).cadence.invoke(c, i),
    [channel, input] as const,
  );
  return result as ChannelOutput<C>;
}

/** The design's keyboard (Main:36 "Roland FP-30X connected"). */
export const DESIGN_KEYBOARD = { id: 'fp30x', name: 'Roland FP-30X' } as const;

type FakeMidiWindow = {
  __cadenceDev?: { midi?: { fakeDevices?(devices: { id: string; name: string }[]): void } };
};

/**
 * Task 16: replace the host's real Web MIDI ports with fake ones run through the real
 * WebMidiInput (`[]` = no keyboard), so pills, copy and screenshots do not depend on what is
 * plugged into the machine running the tests. Lasts until the next reload.
 */
export async function fakeKeyboard(
  page: Page,
  devices: ReadonlyArray<{ id: string; name: string }> = [DESIGN_KEYBOARD],
): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as FakeMidiWindow).__cadenceDev?.midi?.fakeDevices === 'function',
  );
  await page.evaluate((d) => {
    (window as FakeMidiWindow).__cadenceDev?.midi?.fakeDevices?.([...d]);
  }, devices);
}

/**
 * Seed a scenario, then reload the renderer so every query refetches against the new state.
 * The reloaded app hears the design's keyboard (a fake port; see `fakeKeyboard`).
 */
export async function seed(
  page: Page,
  scenario: ChannelInput<'dev.seed'>['scenario'],
): Promise<void> {
  await invoke(page, 'dev.seed', { scenario });
  await page.reload();
  await fakeKeyboard(page);
}

/** Navigate inside the hash router without a full reload. */
export async function go(page: Page, route: string): Promise<void> {
  await page.evaluate((r) => {
    window.location.hash = r.startsWith('#') ? r : `#${r}`;
  }, route);
}
