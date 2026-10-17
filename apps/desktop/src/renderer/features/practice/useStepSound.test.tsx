// decisions.md 2026-10-17 "Melody tracks": a step's `play` prompt plays itself once per visit
// ("Play it again" repeats it); a `hint` demo plays only on request ("Hear it").
import { arpeggiosLevel, echoLevel, smoothProgressionsLevel } from '@cadence/content';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import { SynthContext } from '../../audio/useAudio';
import { AUTO_PLAY_MS, stepSound, stepSoundLabel, useStepSound } from './useStepSound';

const C = { tonic: 'C', mode: 'major' } as const;
const echo = echoLevel(C).steps[0];
const arp = arpeggiosLevel(C).steps[0];
const smooth = smoothProgressionsLevel(C).steps[0];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function setup(step: typeof echo, autoKey: string | null) {
  const synth = new NullSynth();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SynthContext.Provider value={synth}>{children}</SynthContext.Provider>
  );
  const hook = renderHook(({ k }: { k: string | null }) => useStepSound(step, k), {
    wrapper,
    initialProps: { k: autoKey },
  });
  return { synth, hook };
}

describe('stepSound', () => {
  it('a progression plays its path, a prompt plays itself, a demo waits to be asked', () => {
    expect(stepSound(smooth)?.kind).toBe('chords');
    expect(stepSound(echo)).toMatchObject({ kind: 'sound', prompt: true });
    expect(stepSound(arp)).toMatchObject({ kind: 'sound', prompt: false });
    expect(stepSoundLabel(stepSound(echo))).toBe('Play it again');
    expect(stepSoundLabel(stepSound(arp))).toBe('Hear it');
    expect(stepSound(undefined)).toBeNull();
  });
});

describe('useStepSound', () => {
  it('an echo prompt plays itself once per visit, and again on request', async () => {
    const { synth, hook } = setup(echo, '0:0');
    expect(synth.sounds).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_PLAY_MS);
    });
    expect(synth.sounds).toEqual([echo?.play]);
    hook.rerender({ k: '0:0' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_PLAY_MS * 3);
    });
    expect(synth.sounds).toHaveLength(1);
    act(() => hook.result.current.play());
    expect(synth.sounds).toHaveLength(2);
    // A new visit (the next step, or the key restarted) plays it again.
    hook.rerender({ k: '1:0' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_PLAY_MS);
    });
    expect(synth.sounds).toHaveLength(3);
  });

  it('a demo never plays by itself; nothing plays while not listening', async () => {
    const demo = setup(arp, '0:0');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_PLAY_MS * 3);
    });
    expect(demo.synth.sounds).toHaveLength(0);
    expect(demo.hook.result.current.label).toBe('Hear it');
    act(() => demo.hook.result.current.play());
    expect(demo.synth.sounds).toEqual([arp?.hint]);

    const idle = setup(echo, null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_PLAY_MS * 3);
    });
    expect(idle.synth.sounds).toHaveLength(0);
  });
});
