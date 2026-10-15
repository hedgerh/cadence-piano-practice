// Practice.dc.html — the presentational screen. PracticePage (live session) and the dev
// screen (fixture) both render this from a PracticeState.
import { pretty } from '@cadence/music';
import { PianoKeyboard } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { renderBold } from '../../components/ui/Callout';
import { BulbIcon, PlayIcon } from '../../components/ui/icons';
import { NoteChips } from '../../components/ui/NoteChips';
import { OutlineInkButton } from '../../components/ui/OutlineInkButton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { RomanChip } from '../../components/ui/RomanChip';
import { SegmentedProgress } from '../../components/ui/SegmentedProgress';
import { ShowMeControl } from '../../components/ui/ShowMeControl';
import { TaskHeader, type EyebrowTone } from '../../components/ui/TaskHeader';
import { TextButton } from '../../components/ui/TextButton';
import type { MidiStatus } from '../../midi/MidiInput';
import { cx } from '../../lib/cx';
import { MidiStateBanner } from './MidiStateBanner';
import styles from './PracticePage.module.css';
import {
  canRestartLevel,
  currentStep,
  doneCount,
  HINT_LABELS,
  type PracticeState,
  type Visibility,
} from './practiceReducer';
import {
  canRestart,
  chordShort,
  chordStates,
  finishCopy,
  hintNames,
  keyboardCaption,
  keyboardStates,
  keyboardStart,
  keyboardVariant,
  practiceNoun,
  progressionParts,
  progressSegments,
  tooFarCopy,
  keyProgressView,
  type MarkPlayedMode,
} from './practiceSelectors';
import type { XpToast } from './usePracticeSession';

export interface PracticeViewProps {
  state: PracticeState;
  /** Header title and the finish copy's key name ("A major"). */
  title: string;
  /** The level's content note ("Relative major: **C major**. …"), shown under the prompt. */
  note?: string | null;
  eyebrow: { text: string; tone: EyebrowTone };
  midiStatus: MidiStatus;
  /** Fixed header pill (dev fixtures). The live page omits it: the pill opens the device picker. */
  headerMidiStatus?: MidiStatus | undefined;
  markPlayed: MarkPlayedMode;
  onHint: () => void;
  onSkip: () => void;
  /** Progression steps: back to the first chord ("Start over"); omitted = no button. */
  onRestart?: (() => void) | undefined;
  /** Back to step 1 of the key ("Restart key"); omitted = no button. */
  onRestartKey?: (() => void) | undefined;
  onMarkPlayed: () => void;
  onVisibility: (vis: Visibility) => void;
  onFinish: () => void;
  finishing?: boolean;
  finishError?: string | null;
  /** decisions.md 2026-10-01: the key finishes by itself; show "Finishing…" under the button. */
  autoFinishing?: boolean;
  /** Task 09: "+5 XP" after each recorded step. */
  xpToast?: XpToast | null;
  /** Circle tracks: this key's place and the completed keys (decisions.md 2026-10-11). */
  keyProgress?: { position: number; total: number; done: boolean[] } | null;
  /** The session is a circle run (dots count the run, not completion). */
  run?: boolean;
  /** Progression steps: play the voice-led path ("Hear it"); omitted = no button. */
  onHear?: (() => void) | undefined;
  hearing?: boolean;
}

export function PracticeView({
  state,
  title,
  note = null,
  eyebrow,
  midiStatus,
  headerMidiStatus,
  markPlayed,
  onHint,
  onSkip,
  onRestart,
  onRestartKey,
  onMarkPlayed,
  onVisibility,
  onFinish,
  finishing = false,
  finishError = null,
  autoFinishing = false,
  xpToast = null,
  onHear,
  hearing = false,
  keyProgress = null,
  run: inRun = false,
}: PracticeViewProps) {
  const run = keyProgressView(keyProgress, inRun);
  const total = state.steps.length;
  const finished = state.phase === 'finished';
  const step = currentStep(state);
  const names = hintNames(state);
  const copy = finished ? finishCopy(state, title) : null;
  const chips = chordStates(state);
  // Show me (numerals / names / the strip of all 7) is about chords; scale levels always name
  // the step ("A minor scale, going up") and skip the strip.
  const noun = practiceNoun(state);
  const chordLevel = noun === 'chord';
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const parts = progressionParts(state);
  const variant = keyboardVariant(state);
  const keyStart = keyboardStart(state);
  const nudge = tooFarCopy(state);

  return (
    <div
      className={styles.page}
      data-testid="practice"
      data-phase={state.phase}
      data-current={state.current}
      data-hint={state.hint}
    >
      <TaskHeader
        backTo="/"
        backLabel="Today"
        title={title}
        eyebrow={eyebrow.text}
        eyebrowTone={eyebrow.tone}
        midiStatus={headerMidiStatus}
      />

      <div className={styles.bar}>
        <div className={styles.progress}>
          <SegmentedProgress
            segments={progressSegments(state)}
            maxWidth={420}
            data-testid="practice-progress"
          />
          <span className={styles.count} data-testid="practice-count">
            {doneCount(state)} of {total} {noun}s
          </span>
          {onRestartKey !== undefined && canRestartLevel(state) && (
            // decisions.md 2026-10-14 "Restart key": back to the first step of this key.
            <TextButton onClick={onRestartKey} data-testid="restart-key">
              Restart key
            </TextButton>
          )}
        </div>
        {run && (
          <div className={styles.run} role="img" aria-label={run.aria} data-testid="run-progress">
            <span className={styles.runDots}>
              {run.dots.map((d, i) => (
                <span key={i} className={cx(styles.runDot, styles[d])} data-state={d} />
              ))}
            </span>
            <span className={styles.count}>{run.label}</span>
          </div>
        )}
        {chordLevel && <ShowMeControl value={state.vis} onChange={onVisibility} />}
      </div>

      <main className={styles.main}>
        {!finished && step && (
          <>
            <div className={styles.prompt}>
              <span className={styles.chordNo} data-testid="chord-no">
                {Noun} {state.current + 1} of {total}
              </span>
              {parts.length > 0 ? (
                // decisions.md 2026-10-10 "Voice leading": one chip per chord, in order.
                <div className={styles.parts} data-testid="progression-parts">
                  {parts.map((p, i) => (
                    <div key={i} className={styles.part}>
                      <RomanChip
                        mode="state"
                        size={64}
                        numeral={p.label}
                        {...(p.sub !== undefined ? { sub: p.sub } : {})}
                        state={p.state}
                        data-testid={`part-${i}`}
                      />
                      {/* decisions.md 2026-10-14 "Progression help": the notes you used. */}
                      <span className={styles.played} data-testid={`part-played-${i}`}>
                        {p.played ?? ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className={styles.numeral} data-testid="numeral">
                  {step.label}
                </span>
              )}
              {(state.vis !== 'num' || !chordLevel) && (
                <span className={styles.name} data-testid="chord-name">
                  {pretty(step.name)}
                </span>
              )}
              {note !== null && (
                <span className={styles.note} data-testid="level-note">
                  {renderBold(note)}
                </span>
              )}
            </div>
            {names.length > 0 && <NoteChips notes={names} />}
            {nudge !== null && (
              <span className={styles.nudge} role="status" data-testid="too-far">
                {renderBold(nudge)}
              </span>
            )}
          </>
        )}

        {copy && (
          <div className={styles.finished} data-testid="practice-finished">
            <span className={styles.finishedTitle}>{copy.title}</span>
            <span className={styles.finishedBody}>{copy.body}</span>
            <div className={styles.finishCta}>
              <PrimaryButton onClick={onFinish} disabled={finishing} data-testid="finish-key">
                Finish the key
              </PrimaryButton>
            </div>
            {autoFinishing && (
              <span className={styles.finishHint} role="status" data-testid="auto-finish-hint">
                Finishing…
              </span>
            )}
            {finishError !== null && (
              <span className={styles.finishError} role="alert">
                {finishError}
              </span>
            )}
          </div>
        )}

        <div className={styles.keys}>
          <PianoKeyboard
            variant={variant}
            {...(keyStart !== undefined ? { startMidi: keyStart } : {})}
            live
            states={keyboardStates(state)}
            data-testid="practice-keyboard"
          />
          <span className={styles.caption} data-testid="keyboard-caption">
            {keyboardCaption(state)}
          </span>
        </div>

        {!finished && (
          <>
            <MidiStateBanner status={midiStatus} />
            <div className={styles.actions}>
              <OutlineInkButton
                icon={<BulbIcon />}
                onClick={onHint}
                disabled={state.hint >= 2}
                data-testid="hint-button"
              >
                {HINT_LABELS[state.hint]}
              </OutlineInkButton>
              {onHear !== undefined && parts.length > 0 && (
                <OutlineInkButton
                  icon={<PlayIcon size={18} />}
                  onClick={onHear}
                  disabled={hearing}
                  data-testid="hear-progression"
                >
                  Hear it
                </OutlineInkButton>
              )}
              {markPlayed === 'text' && (
                <TextButton underline onClick={onMarkPlayed} data-testid="mark-played">
                  No keyboard? Mark as played
                </TextButton>
              )}
              {markPlayed === 'promoted' && (
                <OutlineInkButton onClick={onMarkPlayed} data-testid="mark-played">
                  Mark as played
                </OutlineInkButton>
              )}
              {onRestart !== undefined && canRestart(state) && (
                <TextButton onClick={onRestart} data-testid="restart-progression">
                  Restart progression
                </TextButton>
              )}
              <TextButton onClick={onSkip} data-testid="skip">
                Skip for now
              </TextButton>
            </div>
          </>
        )}
      </main>

      {state.vis === 'all' && chordLevel && (
        <footer className={styles.footer} data-testid="practice-strip">
          <div className={styles.strip}>
            {state.steps.map((s, i) => (
              <RomanChip
                key={s.id}
                mode="state"
                size={64}
                numeral={s.label}
                sub={chordShort(s)}
                state={chips[i] ?? 'upcoming'}
                data-testid={`strip-chip-${i}`}
              />
            ))}
          </div>
        </footer>
      )}

      {xpToast !== null && (
        <div key={xpToast.id} className={styles.xpToast} role="status" data-testid="xp-toast">
          +{xpToast.amount} XP
        </div>
      )}
    </div>
  );
}
