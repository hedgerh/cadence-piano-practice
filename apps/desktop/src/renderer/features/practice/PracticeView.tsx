// Practice.dc.html — the presentational screen. PracticePage (live session) and the dev
// screen (fixture) both render this from a PracticeState.
import { pretty } from '@cadence/music';
import { PianoKeyboard } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { renderBold } from '../../components/ui/Callout';
import { BulbIcon } from '../../components/ui/icons';
import { NoteChips } from '../../components/ui/NoteChips';
import { OutlineInkButton } from '../../components/ui/OutlineInkButton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { RomanChip } from '../../components/ui/RomanChip';
import { SegmentedProgress } from '../../components/ui/SegmentedProgress';
import { ShowMeControl } from '../../components/ui/ShowMeControl';
import { TaskHeader, type EyebrowTone } from '../../components/ui/TaskHeader';
import { TextButton } from '../../components/ui/TextButton';
import type { MidiStatus } from '../../midi/MidiInput';
import { MidiStateBanner } from './MidiStateBanner';
import styles from './PracticePage.module.css';
import {
  currentStep,
  doneCount,
  HINT_LABELS,
  type PracticeState,
  type Visibility,
} from './practiceReducer';
import {
  chordShort,
  chordStates,
  finishCopy,
  hintNames,
  keyboardStates,
  practiceNoun,
  progressSegments,
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
  onMarkPlayed: () => void;
  onVisibility: (vis: Visibility) => void;
  onFinish: () => void;
  finishing?: boolean;
  finishError?: string | null;
  /** decisions.md 2026-10-01: the key finishes by itself; show "Finishing…" under the button. */
  autoFinishing?: boolean;
  /** Task 09: "+5 XP" after each recorded step. */
  xpToast?: XpToast | null;
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
  onMarkPlayed,
  onVisibility,
  onFinish,
  finishing = false,
  finishError = null,
  autoFinishing = false,
  xpToast = null,
}: PracticeViewProps) {
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
        </div>
        {chordLevel && <ShowMeControl value={state.vis} onChange={onVisibility} />}
      </div>

      <main className={styles.main}>
        {!finished && step && (
          <>
            <div className={styles.prompt}>
              <span className={styles.chordNo} data-testid="chord-no">
                {Noun} {state.current + 1} of {total}
              </span>
              <span className={styles.numeral} data-testid="numeral">
                {step.label}
              </span>
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
            variant="two-octave"
            live
            states={keyboardStates(state)}
            data-testid="practice-keyboard"
          />
          <span className={styles.caption} data-testid="keyboard-caption">
            {chordLevel
              ? 'Keys light up as you play. Hints light up the target.'
              : 'One note at a time, any octave. Each right note stays lit; a wrong one starts the run again.'}
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
