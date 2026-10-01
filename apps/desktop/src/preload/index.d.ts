import type { CadenceBridge } from './index';

declare global {
  interface Window {
    cadence: CadenceBridge;
  }
}

export {};
