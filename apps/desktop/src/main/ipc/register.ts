import type { IpcMain } from 'electron';
import { channels, contracts, type Channel, type Handlers } from '../../shared/ipc/contracts';

/** The slice of `ipcMain` this module needs (a fake in register.test.ts). */
export type IpcMainLike = Pick<IpcMain, 'handle'>;

export interface RegisterOptions {
  /** Called with every rejected invocation before the error reaches the renderer. */
  onError?: (channel: Channel, error: unknown) => void;
}

/**
 * Registers one `ipc.handle` per contract channel that has a handler. Input and output are both
 * parsed with the contract's zod schemas, so a malformed renderer payload or a handler returning
 * the wrong shape fails loudly instead of corrupting state. Only contract channels are ever
 * registered (extra keys on `handlers` are ignored); a dev channel without a handler is skipped,
 * so invoking it rejects with Electron's "No handler registered".
 *
 * Returns the registered channel names.
 */
export function registerHandlers(
  ipc: IpcMainLike,
  handlers: Handlers,
  options: RegisterOptions = {},
): Channel[] {
  const registered: Channel[] = [];
  for (const channel of channels) {
    const contract = contracts[channel];
    const handler = handlers[channel] as ((input: unknown) => unknown) | undefined;
    if (!handler) continue;
    ipc.handle(channel, async (_event, rawInput: unknown) => {
      try {
        const input: unknown = contract.input.parse(rawInput);
        const output = await handler(input);
        return contract.output.parse(output);
      } catch (err) {
        options.onError?.(channel, err);
        throw err;
      }
    });
    registered.push(channel);
  }
  return registered;
}
