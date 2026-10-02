// EarInterval.dc.html generalized (Task 13): the drill shell for every `choice` ear stage.
// Optional `context` sound → the 72px outlined "Hear the key" button (EarChord.dc.html:57–64);
// the 112px PlayButton plays `step.play`; chips come from `match.options` gated by the level's
// `activeOptions`; labels, feedback copy and chip size come from the stage (choiceModel.ts).
// Chords in a key (Task 14, EarChord.dc.html) adds the numeral chips' Show-me caption.
import type { ReactNode } from 'react';
import type { KeyStates } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { AnswerChip, type AnswerChipState } from '../../components/ui/AnswerChip';
import { FeedbackPanel } from '../../components/ui/FeedbackPanel';
import { PlayButton } from '../../components/ui/PlayButton';
import { SegmentedProgress } from '../../components/ui/SegmentedProgress';
import { TaskHeader } from '../../components/ui/TaskHeader';
import { TextButton } from '../../components/ui/TextButton';
import { qualityColor } from '../../lib/quality';
import type { MidiStatus } from '../../midi/MidiInput';
import {
  answeredQuality,
  chipSize,
  contextKeyTitle,
  drillEyebrow,
  feedbackCopy,
  feedbackMinWidth,
  litKeys,
  numeralsCaption,
  optionLabel,
  playbackText,
  stageCopy,
  type EarStageKind,
  type Visibility,
} from './choiceModel';
import styles from './ChoiceDrill.module.css';
import { earSegments, progressLabel } from './earDrillReducer';
import type { EarDrillApi } from './useEarDrill';

export interface ChoiceDrillProps {
  drill: EarDrillApi;
  kind: EarStageKind;
  /** "Intervals · Level 3". */
  title: string;
  /** The level's enabled options; null = all enabled. */
  activeOptions: readonly string[] | null;
  backTo: string;
  backLabel?: string;
  /** Overrides the live MIDI pill (fixtures). */
  midiStatus?: MidiStatus | undefined;
  /** The ear track's Show-me setting (chords in a key hides chord names on `num`). */
  visibility?: Visibility | undefined;
  /** The session's focus (`'misses'` → "Focus · the ones you missed" eyebrow). */
  focus?: string | null;
}

/** EarInterval:143–156 — chip state per option. */
export function chipState(
  option: string,
  active: boolean,
  answered: boolean,
  answer: string,
  chosen: string | null,
): AnswerChipState {
  if (!active) return 'inactive';
  if (!answered) return 'active';
  if (option === answer) return 'correct';
  if (option === chosen) return 'chosen-wrong';
  return 'dimmed';
}

export function ChoiceDrill({
  drill,
  kind,
  title,
  activeOptions,
  backTo,
  backLabel = 'Ear training',
  midiStatus,
  visibility,
  focus = null,
}: ChoiceDrillProps) {
  const { state, question } = drill;
  const copy = stageCopy(kind, state.questions, question);
  const answered = state.phase === 'answered';
  const match = question?.match;
  const options = match?.type === 'choice' ? match.options : [];
  const answer = match?.type === 'choice' ? match.answer : '';
  const isActive = (o: string) => activeOptions === null || activeOptions.includes(o);
  const someInactive = options.some((o) => !isActive(o));
  const key = contextKeyTitle(question);
  const hasContext = question?.context !== undefined;

  const mainButton: ReactNode = (
    <div className={hasContext ? styles.playColumnChord : styles.playColumn}>
      <PlayButton
        size={112}
        aria-label={copy.playAria}
        onClick={drill.play}
        data-testid="ear-play"
      />
      <span className={styles.playLabel} data-testid="ear-play-label">
        {state.played ? copy.playAgain : copy.play}
      </span>
      {!hasContext && (
        <span className={styles.prompt} data-testid="ear-prompt">
          {copy.prompt}
        </span>
      )}
    </div>
  );

  const chips: ReactNode = (
    <div className={styles.chips} data-testid="ear-chips">
      {options.map((o) => {
        const active = isActive(o);
        const st = chipState(o, active, answered, answer, state.chosen);
        const label = optionLabel(kind, o, { question, visibility });
        const quality = st === 'correct' ? answeredQuality(kind, o) : null;
        return (
          <AnswerChip
            key={o}
            size={chipSize(kind)}
            primary={label.primary}
            secondary={label.secondary}
            state={st}
            fill={quality !== null ? qualityColor(quality) : undefined}
            disabled={!active || !drill.enabled}
            onClick={() => drill.pick(o)}
            data-testid={`answer-${o}`}
          />
        );
      })}
    </div>
  );

  let keys: KeyStates = {};
  if (question !== undefined && answered) {
    keys = Object.fromEntries(litKeys(question).map((m) => [m, 'correct' as const]));
  }

  return (
    <div
      className={styles.page}
      data-testid="ear-drill"
      data-kind={kind}
      data-phase={state.phase}
      data-q={state.q}
      data-enabled={drill.enabled}
    >
      <TaskHeader
        backTo={backTo}
        backLabel={backLabel}
        title={title}
        eyebrow={drillEyebrow(focus, copy.eyebrow)}
        eyebrowTone="lavender"
        midiStatus={midiStatus}
      />

      <div className={styles.bar}>
        <SegmentedProgress
          segments={earSegments(state)}
          maxWidth={520}
          data-testid="ear-progress"
        />
        <span className={styles.count} data-testid="ear-count">
          {progressLabel(state)}
        </span>
      </div>

      <main className={styles.main}>
        {hasContext ? (
          <div className={styles.playRow}>
            <div className={styles.contextColumn}>
              <PlayButton
                size={72}
                aria-label={key !== null ? `Hear the key of ${key}` : 'Hear the key'}
                onClick={drill.playContext}
                data-testid="ear-context-play"
              />
              <span className={styles.contextLabel}>Hear the key</span>
            </div>
            {mainButton}
          </div>
        ) : (
          mainButton
        )}

        {hasContext ? (
          <div className={styles.chipBlock}>
            <span className={styles.question} data-testid="ear-prompt">
              {copy.prompt}
            </span>
            {chips}
            {kind === 'numerals' && (
              <span className={styles.caption} data-testid="ear-caption">
                {numeralsCaption(visibility)}
              </span>
            )}
          </div>
        ) : (
          chips
        )}

        {!answered && someInactive && (
          <span className={styles.greyed} data-testid="ear-greyed">
            {copy.greyed}
          </span>
        )}

        {answered && question !== undefined && state.chosen !== null && state.correct !== null && (
          <FeedbackPanel
            correct={state.correct}
            {...feedbackCopy(kind, question, state.chosen, state.correct)}
            playback={playbackText(question)}
            playedBack={state.playedBack}
            keys={keys}
            minTextWidth={feedbackMinWidth(kind)}
            onNext={drill.next}
          />
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
