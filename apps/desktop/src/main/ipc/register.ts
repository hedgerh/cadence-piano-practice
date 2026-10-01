import { ipcMain } from 'electron';
import { channels, contracts, type Handlers } from '../../shared/ipc/contracts';

/**
 * Registers one ipcMain.handle per contract channel. Input and output are both
 * parsed with the contract's zod schemas, so a malformed renderer payload or a
 * handler returning the wrong shape fails loudly instead of corrupting state.
 * Channels not in the contract are never registered.
 */
export function registerHandlers(handlers: Handlers): void {
  for (const channel of channels) {
    const contract = contracts[channel];
    const handler = handlers[channel] as (input: unknown) => unknown;
    ipcMain.handle(channel, async (_event, rawInput: unknown) => {
      const input = contract.input.parse(rawInput);
      const output = await handler(input);
      return contract.output.parse(output);
    });
  }
}
