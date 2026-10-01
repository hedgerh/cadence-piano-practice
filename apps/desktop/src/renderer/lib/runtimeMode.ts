import { api, queryKey } from './api';
import { queryClient } from './queryClient';

export interface RuntimeMode {
  /** Vite dev server, or main reports `env.dev`. */
  dev: boolean;
  /** Launched by Playwright (`CADENCE_E2E=1`, reported by main as `env.e2e`). */
  e2e: boolean;
  /** Dev routes (/dev/*) and `window.__cadenceDev` are available. */
  devTools: boolean;
}

/**
 * Asks main once at startup (`app.ping`) whether this is an e2e run, and seeds the
 * TanStack cache with the reply so the Shell doesn't ping again. The `env` field is read
 * defensively: older mains (and the zod contract before it gained `env`) omit it, in
 * which case only `import.meta.env.DEV` enables dev tools.
 */
export async function detectRuntimeMode(): Promise<RuntimeMode> {
  const viteDev = import.meta.env.DEV;
  try {
    const ping = await api['app.ping']();
    queryClient.setQueryData(queryKey('app.ping'), ping);
    const env = (ping as { env?: { dev?: boolean; e2e?: boolean } }).env;
    const dev = viteDev || env?.dev === true;
    const e2e = env?.e2e === true;
    return { dev, e2e, devTools: dev || e2e };
  } catch {
    return { dev: viteDev, e2e: false, devTools: viteDev };
  }
}
