import {
  contracts,
  type Channel,
  type ChannelInput,
  type ChannelOutput,
} from '@shared/ipc/contracts';

/**
 * Typed IPC client. `api['plan.getToday']()` is fully typed from the contract,
 * and every response is re-validated so a main/renderer version skew surfaces
 * as a clear zod error rather than an undefined property three screens later.
 *
 * TanStack Query key convention: [channel, input].
 */
type Api = {
  [C in Channel]: ChannelInput<C> extends void
    ? () => Promise<ChannelOutput<C>>
    : (input: ChannelInput<C>) => Promise<ChannelOutput<C>>;
};

export async function invoke<C extends Channel>(
  channel: C,
  input?: ChannelInput<C>,
): Promise<ChannelOutput<C>> {
  const raw = await window.cadence.invoke(channel, input);
  return contracts[channel].output.parse(raw) as ChannelOutput<C>;
}

export const api = new Proxy({} as Api, {
  get(_target, channel: string) {
    if (!(channel in contracts)) throw new Error(`Unknown IPC channel: ${channel}`);
    return (input?: unknown) => invoke(channel as Channel, input as never);
  },
});

export const queryKey = <C extends Channel>(channel: C, input?: ChannelInput<C>) =>
  [channel, input] as const;
