// `/jam/songs/:songId` (decisions.md 2026-10-21 "Songs from MIDI"): learn an imported song.
//   - Wait: the song stops at each step until you strike its exact keys (hands, octaves and
//     inversions as written); the other hand plays itself between your steps if you like.
//   - Play along: the song runs in time at a speed you choose, looping the chosen bars, with
//     your hand left out (or in, to hear it) and its keys lit as they come.
// Ungraded, like Jam: no session, no XP.
import { type Midi, midiToPc, pcName } from '@cadence/music';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { SynthContext } from '../../audio/useAudio';
import { PianoKeyboard, type KeyState } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { keyboardWidth } from '../../components/music/PianoKeyboard/keyboardLayout';
import { AppHeader } from '../../components/ui/AppHeader';
import { OutlineInkButton } from '../../components/ui/OutlineInkButton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { cx } from '../../lib/cx';
import { useMidiEvents } from '../../midi/hooks';
import { JamTabs } from '../jam/JamTabs';
import { useMe, useSong } from '../shared/hooks';
import {
  barAt,
  barRange,
  chordName,
  handsOf,
  keyboardRange,
  pedalDownAt,
  secAt,
  songSteps,
  withPedal,
  type HandChoice,
  type Song,
  type SongNote,
  type SongStep,
} from './songModel';
import { MIN_SPEED, SongPlayer } from './SongPlayer';
import styles from './songs.module.css';
import { startWait, waitNoteOn, type WaitState } from './waitMode';

const PUMP_MS = 25;
/** The widest the keyboard is drawn before it scales down to fit. */
const KEYBOARD_MAX = 1184;
/** Bars shown by default: a phrase to start on. */
const FIRST_BARS = 8;

/** "E♭3" — flats, since most songs people import lean that way; the keys are what matter. */
export function noteName(m: Midi): string {
  return `${pcName(midiToPc(m), 'flats').replace('b', '♭')}${Math.floor(m / 12) - 1}`;
}

export function SongPage() {
  const { songId } = useParams();
  const me = useMe();
  const song = useSong(songId);
  return (
    <div className={styles.page} data-testid="song">
      <AppHeader
        active="jam"
        streakDays={me.data?.streak.days ?? 0}
        xp={me.data?.xpTotal ?? 0}
        showMidi
      />
      <main className={styles.main}>
        <JamTabs active="songs" />
        {song.isError && (
          <p className={styles.error} role="alert">
            This song couldn’t be opened. <Link to="/jam/songs">Back to your songs</Link>
          </p>
        )}
        {song.isPending && <p className={styles.empty}>Opening the song…</p>}
        {song.data && <SongView song={song.data} />}
      </main>
    </div>
  );
}

export function SongView({ song }: { song: Song }) {
  const lastBar = song.bars.at(-1)?.number ?? 1;
  const [mode, setMode] = useState<'wait' | 'play'>('wait');
  const [hands, setHands] = useState<HandChoice>('right');
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(lastBar, FIRST_BARS));
  const [speed, setSpeed] = useState(0.75);
  const [otherHand, setOtherHand] = useState(true);
  const [hearMine, setHearMine] = useState(false);
  const [click, setClick] = useState(false);

  const range = useMemo(() => barRange(song, from, to), [song, from, to]);
  const sounding = useMemo(
    () => ({ left: withPedal(song.left, song.pedal), right: withPedal(song.right, song.pedal) }),
    [song],
  );
  const kb = useMemo(() => keyboardRange(song), [song]);
  const bpm = Math.round(song.tempos[0]?.bpm ?? 120);
  const settingsKey = `${mode}:${hands}:${from}:${to}`;

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.title}>{song.title}</h1>
        <p className={styles.lede}>
          {song.bars.length} bars · {bpm} BPM · imported from {song.fileName}
        </p>
      </div>

      <section className={styles.controls} aria-label="How to practise">
        <div className={styles.toggles} role="group" aria-label="Mode">
          <Toggle on={mode === 'wait'} onClick={() => setMode('wait')} id="mode-wait">
            Wait for me
          </Toggle>
          <Toggle on={mode === 'play'} onClick={() => setMode('play')} id="mode-play">
            Play along
          </Toggle>
        </div>
        <div className={styles.toggles} role="group" aria-label="Hands">
          {(['left', 'right', 'both'] as const).map((h) => (
            <Toggle key={h} on={hands === h} onClick={() => setHands(h)} id={`hands-${h}`}>
              {h === 'left' ? 'Left hand' : h === 'right' ? 'Right hand' : 'Both hands'}
            </Toggle>
          ))}
        </div>
        <label className={styles.field} htmlFor="song-from">
          <span className={styles.fieldLabel}>Bars</span>
          <span className={styles.barPick}>
            <select
              id="song-from"
              className={styles.select}
              value={from}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFrom(v);
                if (to < v) setTo(v);
              }}
              data-testid="song-from"
            >
              {song.bars.map((b) => (
                <option key={b.number} value={b.number}>
                  {b.number}
                </option>
              ))}
            </select>
            to
            <select
              id="song-to"
              aria-label="Last bar"
              className={styles.select}
              value={to}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTo(v);
                if (from > v) setFrom(v);
              }}
              data-testid="song-to"
            >
              {song.bars.map((b) => (
                <option key={b.number} value={b.number}>
                  {b.number}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className={cx(styles.field, styles.speed)} htmlFor="song-speed">
          <span className={styles.fieldLabel}>
            Speed <span className={styles.value}>{Math.round(speed * 100)}%</span>
          </span>
          <input
            id="song-speed"
            type="range"
            min={MIN_SPEED * 100}
            max={100}
            step={5}
            value={Math.round(speed * 100)}
            onChange={(e) => setSpeed(Number(e.target.value) / 100)}
            data-testid="song-speed"
          />
        </label>
        <div className={styles.toggles} role="group" aria-label="Sound">
          {hands !== 'both' && (
            <Toggle on={otherHand} onClick={() => setOtherHand(!otherHand)} id="other-hand">
              Play the other hand
            </Toggle>
          )}
          {mode === 'play' && (
            <>
              <Toggle on={hearMine} onClick={() => setHearMine(!hearMine)} id="hear-mine">
                Play my part too
              </Toggle>
              <Toggle on={click} onClick={() => setClick(!click)} id="click">
                Click
              </Toggle>
            </>
          )}
        </div>
      </section>

      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.swatchLeft)} /> Left hand
        </span>
        <span className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.swatchRight)} /> Right hand
        </span>
        <span className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.swatchNext)} /> Coming next
        </span>
      </div>

      {mode === 'wait' ? (
        <WaitPanel
          key={settingsKey}
          song={song}
          steps={songSteps(song, hands, range.start, range.end)}
          rangeEnd={range.end}
          other={
            hands === 'both' || !otherHand ? [] : sounding[hands === 'left' ? 'right' : 'left']
          }
          speed={speed}
          kb={kb}
        />
      ) : (
        <PlayPanel
          key={settingsKey}
          song={song}
          hands={hands}
          range={range}
          notes={[
            ...(hands !== 'both' && otherHand ? sounding[hands === 'left' ? 'right' : 'left'] : []),
            ...(hearMine ? handsOf(hands).flatMap((h) => sounding[h]) : []),
          ].sort((a, b) => a.beat - b.beat)}
          speed={speed}
          click={click}
          kb={kb}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Wait for me

function WaitPanel({
  song,
  steps,
  rangeEnd,
  other,
  speed,
  kb,
}: {
  song: Song;
  steps: SongStep[];
  rangeEnd: number;
  other: readonly SongNote[];
  speed: number;
  kb: { startMidi: Midi; octaves: number };
}) {
  const synth = useContext(SynthContext);
  const [wait, setWait] = useState<WaitState>(startWait);
  const latest = useRef(wait);

  useMidiEvents((e) => {
    if (e.type !== 'on') return;
    const r = waitNoteOn(steps, latest.current, e.midi);
    latest.current = r.state;
    setWait(r.state);
    if (r.completed === null || other.length === 0) return;
    // The other hand carries on until your next step, at the chosen speed.
    const fromBeat = steps[r.completed]?.beat ?? 0;
    const toBeat = steps[r.completed + 1]?.beat ?? rangeEnd;
    const t0 = synth.now() + 0.02;
    for (const n of other) {
      if (n.beat < fromBeat - 1e-6 || n.beat >= toBeat - 1e-6) continue;
      const at = t0 + (secAt(song, n.beat) - secAt(song, fromBeat)) / speed;
      const dur = (secAt(song, n.beat + n.dur) - secAt(song, n.beat)) / speed;
      synth.playMidi([n.midi], at, Math.max(0.05, dur), n.velocity);
    }
  });

  const step = steps[wait.index];
  const next = steps[wait.index + 1];
  const states = useMemo(() => {
    const out: Record<Midi, KeyState> = {};
    for (const n of next?.notes ?? []) out[n.midi] = 'scale';
    for (const n of step?.notes ?? []) {
      out[n.midi] = wait.hit.includes(n.midi) ? 'correct' : n.hand === 'left' ? 'chord' : 'hint';
    }
    if (wait.wrong !== null) out[wait.wrong] = 'far';
    return out;
  }, [step, next, wait]);

  if (!step) {
    return <p className={styles.empty}>These bars have no notes for that hand. Pick other bars.</p>;
  }
  const where = barAt(song, step.beat);
  const byHand = (hand: 'left' | 'right') =>
    step.notes
      .filter((n) => n.hand === hand)
      .map((n) => noteName(n.midi))
      .join(' ');
  const chord = chordName(step.notes.map((n) => n.midi));
  return (
    <>
      <div className={styles.status} data-testid="song-step">
        <span className={styles.where}>
          Bar {where.number} · beat {formatBeat(where.beatInBar)} · step {wait.index + 1} of{' '}
          {steps.length}
          {wait.loops > 0 ? ` · round ${wait.loops + 1}` : ''}
        </span>
        <span className={styles.notes}>
          {byHand('left') && <span className={styles.leftNotes}>Left: {byHand('left')}</span>}
          {byHand('right') && <span className={styles.rightNotes}>Right: {byHand('right')}</span>}
          {chord && <span className={styles.chord}>≈ {chord}</span>}
          {pedalDownAt(song.pedal, step.beat) && <span className={styles.pedal}>Pedal down</span>}
          {wait.wrong !== null && (
            <span className={styles.wrong} role="status">
              Not in this step: {noteName(wait.wrong)}
            </span>
          )}
        </span>
      </div>
      <SongKeyboard states={states} kb={kb} />
      <div className={styles.transport}>
        <OutlineInkButton
          onClick={() => {
            latest.current = startWait();
            setWait(latest.current);
          }}
          data-testid="song-restart"
        >
          Back to the first bar
        </OutlineInkButton>
        <span className={styles.hint}>
          Play the lit keys: exact octaves, any order. A wrong key turns lavender; the song waits.
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Play along

function PlayPanel({
  song,
  hands,
  range,
  notes,
  speed,
  click,
  kb,
}: {
  song: Song;
  hands: HandChoice;
  range: { start: number; end: number };
  notes: SongNote[];
  speed: number;
  click: boolean;
  kb: { startMidi: Midi; octaves: number };
}) {
  const synth = useContext(SynthContext);
  const [player] = useState(() => new SongPlayer(synth, song));
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      player.pump();
      if (!player.playing) setPlaying(false);
    }, PUMP_MS);
    let raf = 0;
    const frame = () => {
      setBeat(player.beatAt(synth.now()));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, [playing, player, synth]);
  useEffect(() => () => player.stop(), [player]);

  const start = () => {
    void synth.unlock().then(() => {
      player.start({
        notes,
        startBeat: range.start,
        endBeat: range.end,
        speed,
        loop: true,
        click,
        countIn: true,
      });
      setPlaying(true);
    });
  };
  const stop = () => {
    player.stop();
    setPlaying(false);
  };

  const now = playing ? beat : null;
  const mine = useMemo(
    () => handsOf(hands).flatMap((hand) => song[hand].map((n) => ({ ...n, hand }))),
    [song, hands],
  );
  const states = useMemo(() => {
    const out: Record<Midi, KeyState> = {};
    if (now === null) return out;
    for (const n of mine) {
      if (n.beat > now && n.beat <= now + 1) out[n.midi] ??= 'scale';
    }
    for (const n of mine) {
      if (n.beat <= now + 1e-6 && now < n.beat + Math.max(n.dur, 0.25)) {
        out[n.midi] = n.hand === 'left' ? 'chord' : 'hint';
      }
    }
    return out;
  }, [mine, now]);

  const where = now === null ? null : barAt(song, now);
  return (
    <>
      <div className={styles.status} data-testid="song-position">
        <span className={styles.where}>
          {where === null
            ? playing
              ? 'Count-in…'
              : `Bars ${barAt(song, range.start).number}–${barAt(song, range.end - 1e-6).number}, looping. Press Play.`
            : `Bar ${where.number} · beat ${formatBeat(where.beatInBar)}`}
        </span>
        {now !== null && pedalDownAt(song.pedal, now) && (
          <span className={styles.pedal}>Pedal down</span>
        )}
      </div>
      <SongKeyboard states={states} kb={kb} />
      <div className={styles.transport}>
        {playing ? (
          <PrimaryButton onClick={stop} data-testid="song-stop">
            Stop
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={start} data-testid="song-play">
            Play
          </PrimaryButton>
        )}
        <span className={styles.hint}>
          Your keys light as they come (outlined just before). Change the speed or bars, then Play
          again.
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- shared

function SongKeyboard({
  states,
  kb,
}: {
  states: Record<Midi, KeyState>;
  kb: { startMidi: Midi; octaves: number };
}) {
  const width = keyboardWidth('three-octave', kb.octaves);
  const scale = Math.min(1, KEYBOARD_MAX / width);
  return (
    <div className={styles.keyboardWrap} style={{ width: width * scale, height: 156 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width }}>
        <PianoKeyboard
          variant="three-octave"
          startMidi={kb.startMidi}
          octaves={kb.octaves}
          live
          states={states}
          data-testid="song-keyboard"
        />
      </div>
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
      data-testid={`song-${id}`}
    >
      {children}
    </button>
  );
}

/** Beat inside the bar as players count it: "1", "2½", "4¾". */
export function formatBeat(beatInBar: number): string {
  const whole = Math.floor(beatInBar + 1e-6);
  const frac = beatInBar - whole;
  const mark =
    Math.abs(frac - 0.5) < 0.05
      ? '½'
      : Math.abs(frac - 0.25) < 0.05
        ? '¼'
        : Math.abs(frac - 0.75) < 0.05
          ? '¾'
          : Math.abs(frac - 1 / 3) < 0.05
            ? '⅓'
            : Math.abs(frac - 2 / 3) < 0.05
              ? '⅔'
              : '';
  return `${whole + 1}${mark}`;
}
