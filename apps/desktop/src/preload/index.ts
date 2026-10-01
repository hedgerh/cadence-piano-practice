import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

/**
 * The preload exposes exactly two generic functions. Channel names and payload
 * shapes are governed by shared/ipc/contracts.ts, validated in main, and typed
 * in the renderer by lib/api.ts — so adding a procedure never touches this file.
 */
const bridge = {
  invoke: (channel: string, payload: unknown): Promise<unknown> =>
    ipcRenderer.invoke(channel, payload),
  on: (channel: string, listener: (payload: unknown) => void): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.off(channel, wrapped);
    };
  },
};

export type CadenceBridge = typeof bridge;

contextBridge.exposeInMainWorld('cadence', bridge);
