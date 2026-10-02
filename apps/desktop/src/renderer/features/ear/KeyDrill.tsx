// Find the key (EarKey.dc.html, Task 15). Hear an 8-note phrase, hunt for its home note on the
// MIDI keyboard (tries show faintly, home stays lit in every octave), then call it major or
// minor. EarDrillPage routes levels whose steps use a `root` match here.
import { useNavigate } from 'react-router';
import { PianoKeyboard } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { FeedbackPanel } from '../../components/ui/FeedbackPanel';
import { OutlineInkButton } from '../../components/ui/OutlineInkButton';
import { PlayButton } from '../../components/ui/PlayButton';
import { SegmentedProgress } from '../../components/ui/SegmentedProgress';
import { StepCard } from '../../components/ui/StepCard';
import { TaskHeader } from '../../components/ui/TaskHeader';
import { TextButton } from '../../components/ui/TextButton';
import type { MidiStatus } from '../../midi/MidiInput';
import { useInvalidateProgress } from '../shared/hooks';
import { drillEyebrow } from './choiceModel';
import { earSegments, type EarSession } from './earDrillReducer';
import styles from './KeyDrill.module.css';
import {
  feedbackKeys,
  keyboardStates,
  keyFeedback,
  keyProgressLabel,
  modeLabel,
  modeOptions,
  questionKey,
  stepOneCopy,
  stepTwoCopy,
} from './keyModel';
import {
  useEarDrill,
  useLiveEarIo,
  type EarDrillApi,
  type EarResultsRouteState,
} from './useEarDrill';

export interface KeyDrillProps {
  session: EarSession;
  backTo: string;
}

/** The live drill: real IPC, results screen after the last phrase. */
export function KeyDrill({ session, backTo }: KeyDrillProps) {
  return <LiveKeyDrill key={session.sessionId} session={session} backTo={backTo} />;
}

function LiveKeyDrill({ session, backTo }: KeyDrillProps) {
  const io = useLiveEarIo();
  const navigate = useNavigate();
  const invalidate = useInvalidateProgress();
  const drill = useEarDrill(session, io, {
    onFinished: (complete) => {
      void invalidate();
      const state: EarResultsRouteState = { complete };
      void navigate(`/ear/results/${encodeURIComponent(complete.sessionId)}`, { state });
    },
  });
  return (
    <KeyDrillView drill={drill} title={session.shortTitle} backTo={backTo} focus={session.focus} />
  );
}

export interface KeyDrillViewProps {
  drill: EarDrillApi;
  /** "Find the key · Level 1" (EarKey:28). */
  title: string;
  backTo: string;
  backLabel?: string;
  /** Overrides the live MIDI pill (fixtures). */
  midiStatus?: MidiStatus | undefined;
  /** The session's focus (`'misses'` → "Focus · the ones you missed" eyebrow). */
  focus?: string | null;
}

export function KeyDrillView({
  drill,
  title,
  backTo,
  backLabel = 'Ear training',
  midiStatus,
  focus = null,
}: KeyDrillViewProps) {
  const { state, question } = drill;
  const key = questionKey(question);
  const answered = state.phase === 'answered';
  const last = state.results[state.results.length - 1];
  const result =
    answered && last !== undefined && last.ordinal === question?.ordinal
      ? { result: last.result, hinted: state.hinted }
      : null;
  const step1 = stepOneCopy(state.root, key);
  const step2 = stepTwoCopy(state.root, key, result);
  const canPick = drill.enabled && state.root.found;

  return (
    <div
      className={styles.page}
      data-testid="key-drill"
      data-phase={state.phase}
      data-q={state.q}
      data-found={state.root.found}
      data-enabled={canPick}
    >
      <TaskHeader
        backTo={backTo}
        backLabel={backLabel}
        title={title}
        eyebrow={drillEyebrow(focus, 'Hunt for home on your keyboard')}
        eyebrowTone="lavender"
        midiStatus={midiStatus}
      />

      <div className={styles.bar}>
        <SegmentedProgress
          segments={earSegments(state)}
          maxWidth={300}
          data-testid="ear-progress"
        />
        <span className={styles.count} data-testid="ear-count">
          {keyProgressLabel(state)}
        </span>
      </div>

      <main className={styles.main}>
        <div className={styles.playColumn}>
          <PlayButton
            size={112}
            aria-label="Hear the phrase"
            onClick={drill.play}
            data-testid="ear-play"
          />
          <span className={styles.playLabel} data-testid="ear-play-label">
            {state.played ? 'Hear the phrase again' : 'Hear the phrase'}
          </span>
          <span className={styles.prompt}>
            Eight notes, about four seconds. Replay as often as you like.
          </span>
        </div>

        <div className={styles.steps} data-testid="key-steps">
          <StepCard step={1} {...step1} />
          <StepCard step={2} {...step2} />
        </div>

        <div className={styles.keyboardColumn}>
          <PianoKeyboard
            variant="two-octave"
            states={keyboardStates(question, state.root)}
            live
            data-testid="key-keyboard"
          />
          {/* Hidden once answered so the feedback panel fits the 820px window. */}
          {!answered && (
            <span className={styles.caption}>
              Your home note stays lit. Everything else you play shows as you play it.
            </span>
          )}
        </div>

        {answered && question !== undefined && state.chosen !== null && state.correct !== null ? (
          <FeedbackPanel
            correct={state.correct}
            {...keyFeedback(question, state.chosen, state.correct)}
            playback={null}
            keys={feedbackKeys(question)}
            onNext={drill.next}
          />
        ) : (
          state.phase !== 'done' && (
            <div className={styles.answers} data-testid="key-answers">
              {modeOptions(question).map((mode) => (
                <OutlineInkButton
                  key={mode}
                  size={60}
                  disabled={!canPick}
                  onClick={() => drill.pick(mode)}
                  data-testid={`answer-${mode}`}
                >
                  {key ? modeLabel(key.tonic, mode) : mode}
                </OutlineInkButton>
              ))}
              <TextButton
                underline
                disabled={drill.playing || question?.hint === undefined}
                onClick={drill.playHint}
                data-testid="key-hint"
              >
                Hint: hear the phrase&apos;s last chord
              </TextButton>
            </div>
          )
        )}

        {state.phase === 'done' && (
          <div className={styles.done} role={drill.finishError !== null ? 'alert' : 'status'}>
            <span>{drill.finishError ?? 'Adding it up…'}</span>
            {drill.finishError !== null && (
              <TextButton onClick={drill.retryFinish} underline>
                Try again
              </TextButton>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
