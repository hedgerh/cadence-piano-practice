import { describe, expect, it } from 'vitest';
import { channels, contracts } from './contracts';

describe('IPC contracts', () => {
  it('every channel has a zod input and output schema', () => {
    for (const channel of channels) {
      const c = contracts[channel];
      expect(typeof c.input.parse).toBe('function');
      expect(typeof c.output.parse).toBe('function');
    }
  });

  it('channel names are dotted "domain.action" identifiers', () => {
    for (const channel of channels) {
      expect(channel).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
    }
  });

  it('app.ping accepts void and validates its reply shape', () => {
    expect(contracts['app.ping'].input.parse(undefined)).toBeUndefined();
    expect(() =>
      contracts['app.ping'].output.parse({
        ok: true,
        version: '0.1.0',
        userDataPath: 'x',
        env: { dev: true, e2e: false },
      }),
    ).not.toThrow();
    expect(() =>
      contracts['app.ping'].output.parse({ ok: true, version: '0.1.0', userDataPath: 'x' }),
    ).toThrow();
    expect(() => contracts['app.ping'].output.parse({ ok: false })).toThrow();
  });

  it('optional input fields are exact: absent is fine, explicit undefined is rejected', () => {
    const start = contracts['sessions.start'].input;
    expect(() => start.parse({ levelId: 'a-major', kind: 'learn' })).not.toThrow();
    expect(() =>
      start.parse({ levelId: 'a-major', kind: 'learn', planBlockId: 'b1' }),
    ).not.toThrow();
    expect(() =>
      start.parse({ levelId: 'a-major', kind: 'learn', planBlockId: undefined }),
    ).toThrow();
    expect(() => start.parse({ levelId: '', kind: 'learn' })).toThrow();
  });

  it('dev.seed accepts the four core scenarios only', () => {
    const input = contracts['dev.seed'].input;
    for (const scenario of ['first-run', 'day8', 'ear-unlocked', 'advance-day']) {
      expect(input.parse({ scenario })).toEqual({ scenario });
    }
    expect(() => input.parse({ scenario: 'day9' })).toThrow();
  });
});
