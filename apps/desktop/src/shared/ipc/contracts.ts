import { z } from 'zod';

/**
 * The single source of truth for renderer <-> main communication.
 *
 * Adding a procedure = add a key here + implement it in main/ipc/handlers.ts.
 * Preload never changes. Main validates input AND output; the renderer client
 * (renderer/lib/api.ts) re-validates output defensively.
 *
 * Channels are listed in docs/architecture.md §4.3. Task 05 fills them in.
 */
export const contracts = {
  /** Liveness check used by the e2e smoke test and the dev tools. */
  'app.ping': {
    input: z.void(),
    output: z.object({
      ok: z.literal(true),
      version: z.string(),
      userDataPath: z.string(),
    }),
  },
} as const satisfies Record<string, { input: z.ZodType; output: z.ZodType }>;

export type Contracts = typeof contracts;
export type Channel = keyof Contracts;
export type ChannelInput<C extends Channel> = z.input<Contracts[C]['input']>;
export type ChannelOutput<C extends Channel> = z.output<Contracts[C]['output']>;

/** What a main-process implementation of every channel looks like. */
export type Handlers = {
  [C in Channel]: (
    input: z.output<Contracts[C]['input']>,
  ) => Promise<ChannelOutput<C>> | ChannelOutput<C>;
};

export const channels = Object.keys(contracts) as Channel[];
