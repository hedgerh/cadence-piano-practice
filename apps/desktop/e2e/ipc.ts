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

/** Seed a scenario, then reload the renderer so every query refetches against the new state. */
export async function seed(
  page: Page,
  scenario: ChannelInput<'dev.seed'>['scenario'],
): Promise<void> {
  await invoke(page, 'dev.seed', { scenario });
  await page.reload();
}

/** Navigate inside the hash router without a full reload. */
export async function go(page: Page, route: string): Promise<void> {
  await page.evaluate((r) => {
    window.location.hash = r.startsWith('#') ? r : `#${r}`;
  }, route);
}
