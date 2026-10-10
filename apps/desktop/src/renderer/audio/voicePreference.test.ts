// decisions.md 2026-10-11 "Sound setting": the synth follows the cached profile.
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { installVoicePreference } from './voicePreference';

const KEY = ['me.get'] as const;
const me = (voice: 'tone' | 'synth' | 'samples') => ({ settings: { voice } });

describe('installVoicePreference', () => {
  it('applies the cached voice, then every change to the profile query', () => {
    const qc = new QueryClient();
    qc.setQueryData(KEY, me('synth'));
    const voices: string[] = [];
    const stop = installVoicePreference(qc, { setVoice: (v) => voices.push(v) }, KEY);
    expect(voices).toEqual(['synth']);
    qc.setQueryData(KEY, me('tone'));
    expect(voices.at(-1)).toBe('tone');
    qc.setQueryData(['other'], { settings: { voice: 'samples' } });
    expect(voices.at(-1)).toBe('tone');
    stop();
    qc.setQueryData(KEY, me('samples'));
    expect(voices.at(-1)).toBe('tone');
  });
});
