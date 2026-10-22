// `/jam` (decisions.md 2026-10-18 "Jam"; docs/roadmap.md phases 3 and 5): pick a progression,
// a key and a tempo, and play over the loop. Ungraded: no session, no XP, nothing recorded
// beyond this visit's takes. The keyboard lights the chord playing now and the guide scale.
import { JAM_PRESETS, jamChart, jamTonics } from '@cadence/content';
import { type Midi, midiToPc, pcNumber, pretty } from '@cadence/music';
import { useEffect, useMemo, useState } from 'react';
import { PianoKeyboard, type KeyState } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { AppHeader } from '../../components/ui/AppHeader';
import { OutlineInkButton } from '../../components/ui/OutlineInkButton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { RomanChip } from '../../components/ui/RomanChip';
import { TextButton } from '../../components/ui/TextButton';
import { cx } from '../../lib/cx';
import { useMe } from '../shared/hooks';
import styles from './JamPage.module.css';
import {
  LOOP_CHOICES,
  loadPrefs,
  savePrefs,
  tonicFor,
  type JamPrefs,
  type LoopChoice,
} from './jamPrefs';
import { BEATS_PER_BAR, COUNT_IN_BEATS, MAX_BPM, MIN_BPM, positionOf } from './jamTiming';
import type { Take } from './recorder';
import { JamTabs } from './JamTabs';
import { useJam } from './useJam';

/** The keyboard window: C3..B5, the melody's home. */
export const JAM_KEYBOARD_START: Midi = 48;
const KEYBOARD_KEYS = 36;

export function JamPage() {
  const me = useMe();
  return <JamView streakDays={me.data?.streak.days ?? 0} xp={me.data?.xpTotal ?? 0} />;
}

export function JamView({ streakDays, xp }: { streakDays: number; xp: number }) {
  const [prefs, setPrefs] = useState<JamPrefs>(loadPrefs);
  useEffect(() => savePrefs(prefs), [prefs]);
  const preset = JAM_PRESETS.find((p) => p.id === prefs.presetId) ?? JAM_PRESETS[0];
  if (!preset) throw new Error('no Jam presets');
  const chart = useMemo(() => jamChart(preset, prefs.tonic), [preset, prefs.tonic]);
  const settings = useMemo(
    () => ({ bpm: prefs.bpm, comp: prefs.comp, click: prefs.click }),
    [prefs.bpm, prefs.comp, prefs.click],
  );
  const jam = useJam(chart, settings);
  const set = (patch: Partial<JamPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  /** A new progression or key while playing starts the loop over (no count-in). */
  const setChart = (patch: Pick<JamPrefs, 'presetId' | 'tonic'>) => {
    jam.requestRestart();
    set(patch);
  };
  /** Playing a take back switches to its progression, key and tempo. */
  const playBack = (take: Take) => {
    const p = JAM_PRESETS.find((x) => x.id === take.presetId) ?? preset;
    const tonic = tonicFor(p.id, take.tonic);
    set({ presetId: p.id, tonic, bpm: take.bpm });
    jam.playTake(take, jamChart(p, tonic), { ...settings, bpm: take.bpm });
  };

  const beat = jam.beat;
  const countIn = beat !== null && beat < 0 ? COUNT_IN_BEATS + beat + 1 : null;
  const pos = beat !== null && beat >= 0 ? positionOf(chart, beat) : null;
  const current = pos?.chord ?? 0;
  const next = (current + 1) % chart.chords.length;

  const keyStates = useMemo(() => {
    const out: Record<Midi, KeyState> = {};
    const scale = new Set(chart.scale.map(pcNumber));
    const tones = new Set((chart.chords[current]?.notes ?? []).map(pcNumber));
    for (let m = JAM_KEYBOARD_START; m < JAM_KEYBOARD_START + KEYBOARD_KEYS; m++) {
      if (prefs.showChord && tones.has(midiToPc(m))) out[m] = 'chord';
      else if (prefs.showScale && scale.has(midiToPc(m))) out[m] = 'scale';
    }
    return out;
  }, [chart, current, prefs.showChord, prefs.showScale]);

  const phase = jam.recordPhase;
  const recording =
    phase.phase === 'recording' && pos !== null
      ? `Recording · loop ${Math.min(phase.loops, Math.max(1, pos.loop - phase.startLoop + 1))} of ${phase.loops}`
      : null;
  const status =
    countIn !== null
      ? `Count-in · ${countIn}`
      : phase.phase === 'armed'
        ? 'Recording starts at the top of the loop…'
        : phase.phase === 'recording'
          ? (recording ?? 'Recording…')
          : phase.phase === 'playing-take'
            ? 'Playing your take with the backing'
            : jam.playing
              ? `Bar ${(pos?.bar ?? 0) + 1} of ${chart.bars}`
              : 'Press Start: one bar of clicks, then the loop.';

  return (
    <div className={styles.page} data-testid="jam">
      <AppHeader active="jam" streakDays={streakDays} xp={xp} showMidi />
      <main className={styles.main}>
        <JamTabs active="progressions" />
        <div className={styles.intro}>
          <h1 className={styles.title}>Jam</h1>
          <p className={styles.lede}>
            Pick a progression and play over it. Nothing is graded: try chord tones on the changes,
            then wander through the scale.
          </p>
        </div>

        <section className={styles.settings} aria-label="What to play over">
          <label className={styles.field} htmlFor="jam-preset">
            <span className={styles.fieldLabel}>Progression</span>
            <select
              id="jam-preset"
              className={styles.select}
              value={prefs.presetId}
              onChange={(e) =>
                setChart({ presetId: e.target.value, tonic: tonicFor(e.target.value, prefs.tonic) })
              }
              data-testid="jam-preset"
            >
              {JAM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field} htmlFor="jam-key">
            <span className={styles.fieldLabel}>Key</span>
            <select
              id="jam-key"
              className={styles.select}
              value={prefs.tonic}
              onChange={(e) =>
                setChart({
                  presetId: prefs.presetId,
                  tonic: tonicFor(prefs.presetId, e.target.value),
                })
              }
              data-testid="jam-key"
            >
              {jamTonics(preset).map((t) => (
                <option key={t} value={t}>
                  {pretty(t)} {preset.mode}
                </option>
              ))}
            </select>
          </label>
          <label className={cx(styles.field, styles.tempo)} htmlFor="jam-tempo">
            <span className={styles.fieldLabel}>
              Tempo <span className={styles.bpm}>{prefs.bpm} BPM</span>
            </span>
            <input
              id="jam-tempo"
              type="range"
              min={MIN_BPM}
              max={MAX_BPM}
              step={2}
              value={prefs.bpm}
              disabled={phase.phase === 'recording' || phase.phase === 'armed'}
              onChange={(e) => set({ bpm: Number(e.target.value) })}
              data-testid="jam-tempo"
            />
          </label>
          <div className={styles.toggles} role="group" aria-label="Backing and guides">
            {(['held', 'pulse'] as const).map((comp) => (
              <button
                key={comp}
                type="button"
                className={cx(styles.toggle, prefs.comp === comp && styles.on)}
                aria-pressed={prefs.comp === comp}
                onClick={() => set({ comp })}
                data-testid={`jam-comp-${comp}`}
              >
                {comp === 'held' ? 'Held chords' : 'Pulse'}
              </button>
            ))}
            <Toggle on={prefs.click} onClick={() => set({ click: !prefs.click })} id="click">
              Click
            </Toggle>
            <Toggle
              on={prefs.showChord}
              onClick={() => set({ showChord: !prefs.showChord })}
              id="chord"
            >
              Chord tones
            </Toggle>
            <Toggle
              on={prefs.showScale}
              onClick={() => set({ showScale: !prefs.showScale })}
              id="scale"
            >
              Scale
            </Toggle>
          </div>
        </section>

        <p className={styles.blurb} data-testid="jam-blurb">
          {preset.blurb} Scale: {chart.scale.map(pretty).join(' ')}
        </p>

        <div className={styles.chart} data-testid="jam-chart">
          {chart.chords.map((ch, i) => (
            <div key={i} className={styles.chartChord}>
              <RomanChip
                mode="state"
                size={64}
                numeral={ch.numeral}
                sub={ch.bars > 1 ? `${pretty(ch.symbol)} ×${ch.bars}` : pretty(ch.symbol)}
                state={jam.playing && pos !== null && i === current ? 'current' : 'upcoming'}
                data-testid={`jam-chord-${i}`}
              />
              {jam.playing && pos !== null && i === next && chart.chords.length > 1 && (
                <span className={styles.nextLabel}>next</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.position}>
          <span className={styles.beats} aria-hidden="true">
            {Array.from({ length: BEATS_PER_BAR }, (_, i) => {
              const lit =
                countIn !== null
                  ? i === BEATS_PER_BAR - countIn
                  : pos !== null && i === pos.beatInBar;
              return <span key={i} className={cx(styles.beat, lit && styles.beatOn)} />;
            })}
          </span>
          <span className={styles.status} role="status" data-testid="jam-status">
            {status}
          </span>
        </div>

        <PianoKeyboard
          variant="three-octave"
          startMidi={JAM_KEYBOARD_START}
          live
          states={keyStates}
          data-testid="jam-keyboard"
        />

        <div className={styles.transport}>
          {jam.playing ? (
            <PrimaryButton onClick={jam.stop} data-testid="jam-stop">
              Stop
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={jam.start} data-testid="jam-start">
              Start
            </PrimaryButton>
          )}
          <OutlineInkButton
            onClick={() =>
              jam.record(prefs.loops, {
                presetId: prefs.presetId,
                tonic: prefs.tonic,
                bpm: prefs.bpm,
              })
            }
            disabled={phase.phase !== 'idle'}
            data-testid="jam-record"
          >
            Record
          </OutlineInkButton>
          <div className={styles.toggles} role="group" aria-label="Loops to record">
            {LOOP_CHOICES.map((n: LoopChoice) => (
              <button
                key={n}
                type="button"
                className={cx(styles.toggle, styles.narrow, prefs.loops === n && styles.on)}
                aria-pressed={prefs.loops === n}
                aria-label={`Record ${n} loop${n === 1 ? '' : 's'}`}
                onClick={() => set({ loops: n })}
                data-testid={`jam-loops-${n}`}
              >
                ×{n}
              </button>
            ))}
          </div>
        </div>

        {jam.takes.length > 0 && (
          <section className={styles.takes} aria-label="Your takes" data-testid="jam-takes">
            {jam.takes.map((take) => {
              const p = JAM_PRESETS.find((x) => x.id === take.presetId);
              return (
                <div key={take.id} className={styles.take} data-testid={`jam-take-${take.id}`}>
                  <span className={styles.takeName}>
                    Take {take.id} · {p?.title ?? take.presetId} in {pretty(take.tonic)} ·{' '}
                    {take.bpm} BPM · {take.notes.length} notes
                  </span>
                  <TextButton
                    onClick={() => playBack(take)}
                    data-testid={`jam-take-play-${take.id}`}
                  >
                    Play back
                  </TextButton>
                  <TextButton
                    onClick={() => jam.deleteTake(take.id)}
                    data-testid={`jam-take-delete-${take.id}`}
                  >
                    Delete
                  </TextButton>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  id,
  children,
}: {
  on: boolean;
  onClick: () => void;
  id: string;
  children: string;
}) {
  return (
    <button
      type="button"
      className={cx(styles.toggle, on && styles.on)}
      aria-pressed={on}
      onClick={onClick}
      data-testid={`jam-toggle-${id}`}
    >
      {children}
    </button>
  );
}
