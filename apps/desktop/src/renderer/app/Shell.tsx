import { useQuery } from '@tanstack/react-query';
import { api, queryKey } from '../lib/api';

/**
 * Placeholder root. Task 07 replaces this with the Today screen.
 * It exists so the scaffold proves fonts, tokens, IPC and MIDI permission end to end.
 */
export function Shell() {
  const ping = useQuery({ queryKey: queryKey('app.ping'), queryFn: () => api['app.ping']() });

  return (
    <main
      data-testid="shell"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'var(--ground)',
        color: 'var(--ink)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, margin: 0 }}>
        Cadence
      </h1>
      <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 18, margin: 0 }}>
        Scaffold ready. Screens arrive in tasks 07–15.
      </p>
      <p data-testid="ping" style={{ color: 'var(--teal-deep)', fontWeight: 800, fontSize: 14 }}>
        {ping.isSuccess
          ? `IPC ok · v${ping.data.version}`
          : ping.isError
            ? 'IPC error'
            : 'Pinging main…'}
      </p>
    </main>
  );
}
