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
      contracts['app.ping'].output.parse({ ok: true, version: '0.1.0', userDataPath: 'x' }),
    ).not.toThrow();
    expect(() => contracts['app.ping'].output.parse({ ok: false })).toThrow();
  });
});
