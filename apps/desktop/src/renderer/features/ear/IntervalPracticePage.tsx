// `/ear-practice/intervals` (decisions.md 2026-10-11 "Interval practice"): free interval drill.
// The learner toggles which intervals and directions to hear; questions never end and nothing
// is recorded (no session, no XP) — just this visit's score per interval.
import { INTERVALS, type IntervalId } from '@cadence/music';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAudio } from '../../audio/useAudio';
import type { KeyStates } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { AnswerChip } from '../../components/ui/AnswerChip';
import { FeedbackPanel } from '../../components/ui/FeedbackPanel';
import { PlayButton } from '../../components/ui/PlayButton';
import { TaskHeader } from '../../components/ui/TaskHeader';
import { cx } from '../../lib/cx';
import { SoundSetting } from '../shared/SoundSetting';
import { chipState } from './ChoiceDrill';
import drill from './ChoiceDrill.module.css';
import styles from './IntervalPracticePage.module.css';
import {
  addToTally,
  ALL_ROOTS,
  DIRECTION_LABEL,
  DIRECTIONS,
  feedbackFor,
  loadSettings,
  nextQuestion,
  rootLabel,
  saveSettings,
  toggleDirection,
  toggleInterval,
  toggleRoot,
  type PracticeDirection,
  type PracticeQuestion,
  type PracticeSettings,
  type Tally,
} from './intervalPractice';

/** engine.md §5: a new question plays itself after a short pause. */
const AUTO_PLAY_MS = 300;

/** `?dir=down` (from the "Intervals going down" stage) starts with that direction only. */
function initialSettings(dir: string | null): PracticeSettings {
  const saved = loadSettings();
  return dir === 'up' || dir === 'down' || dir === 'together'
    ? { ...saved, directions: [dir] }
    : saved;
}

export function IntervalPracticePage() {
  const [params] = useSearchParams();
  const audio = useAudio();
  const [settings, setSettings] = useState(() => initialSettings(params.get('dir')));
  const [question, setQuestion] = useState<PracticeQuestion | null>(() =>
    nextQuestion(settings, Math.random),
  );
  const [chosen, setChosen] = useState<IntervalId | null>(null);
  const [played, setPlayed] = useState(false);
  const [tally, setTally] = useState<Tally>({});
  const count = useRef(1);

  useEffect(() => saveSettings(settings), [settings]);

  const play = useCallback(() => {
    if (!question) return;
    void audio
      .play(question.sound)
      .catch(() => undefined)
      .finally(() => setPlayed(true));
  }, [audio, question]);

  // Each new question plays itself once.
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });
  useEffect(() => {
    if (!question) return;
    const t = setTimeout(() => playRef.current(), AUTO_PLAY_MS);
    return () => clearTimeout(t);
  }, [question]);

  const advance = useCallback(
    (from: PracticeSettings, prev: PracticeQuestion | null) => {
      audio.stop();
      setChosen(null);
      setPlayed(false);
      setQuestion(nextQuestion(from, Math.random, prev, count.current++));
    },
    [audio],
  );

  const change = (next: PracticeSettings) => {
    setSettings(next);
    // A question the new settings no longer cover is replaced (an answered one stays).
    const stale =
      question === null ||
      !next.intervals.includes(question.interval) ||
      !next.directions.includes(question.direction) ||
      !next.roots.includes(question.rootPc);
    if (stale && chosen === null) advance(next, question);
  };

  const answered = chosen !== null && question !== null;
  const correct = answered && chosen === question.interval;
  const pick = (id: IntervalId) => {
    if (!question || answered || !played) return;
    setChosen(id);
    setTally((t) => addToTally(t, question.interval, id === question.interval));
  };

  const totals = useMemo(() => {
    const rows = Object.values(tally);
    return {
      right: rows.reduce((n, r) => n + (r?.right ?? 0), 0),
      total: rows.reduce((n, r) => n + (r?.total ?? 0), 0),
    };
  }, [tally]);

  const keys: KeyStates = answered
    ? Object.fromEntries(question.keys.map((m) => [m, 'correct' as const]))
    : {};

  return (
    <div className={drill.page} data-testid="interval-practice">
      <TaskHeader
        backTo="/tracks/ear-training"
        backLabel="Ear training"
        title="Interval practice"
        eyebrow="Free practice · nothing is saved"
        eyebrowTone="lavender"
      />

      <section className={styles.settings} aria-label="What to practise">
        <div className={styles.row}>
          <span className={styles.rowLabel}>Intervals</span>
          <div className={styles.toggles}>
            {INTERVALS.map((iv) => {
              const on = settings.intervals.includes(iv.id);
              const t = tally[iv.id];
              return (
                <button
                  key={iv.id}
                  type="button"
                  className={cx(styles.toggle, on && styles.on)}
                  aria-pressed={on}
                  aria-label={`${iv.name}${t ? `, ${t.right} of ${t.total} right` : ''}`}
                  title={iv.name}
                  onClick={() => change(toggleInterval(settings, iv.id))}
                  data-testid={`practice-interval-${iv.id}`}
                >
                  <span className={styles.toggleId}>{iv.id}</span>
                  <span className={styles.toggleScore}>{t ? `${t.right}/${t.total}` : ' '}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Roots</span>
          <div className={styles.toggles}>
            {ALL_ROOTS.map((pc) => {
              const on = settings.roots.includes(pc);
              return (
                <button
                  key={pc}
                  type="button"
                  className={cx(styles.toggle, styles.narrow, on && styles.on)}
                  aria-pressed={on}
                  aria-label={`Start from ${rootLabel(pc)}`}
                  onClick={() => change(toggleRoot(settings, pc))}
                  data-testid={`practice-root-${pc}`}
                >
                  <span className={styles.toggleId}>{rootLabel(pc)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Directions</span>
          <div className={styles.toggles}>
            {DIRECTIONS.map((d: PracticeDirection) => {
              const on = settings.directions.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={cx(styles.toggle, styles.wide, on && styles.on)}
                  aria-pressed={on}
                  onClick={() => change(toggleDirection(settings, d))}
                  data-testid={`practice-direction-${d}`}
                >
                  <span className={styles.toggleId}>{DIRECTION_LABEL[d]}</span>
                </button>
              );
            })}
          </div>
          <span className={styles.score} data-testid="practice-score">
            {totals.total === 0 ? 'No answers yet' : `${totals.right} of ${totals.total} right`}
          </span>
          <div className={styles.sound}>
            <SoundSetting />
          </div>
        </div>
      </section>

      <main className={drill.main}>
        {question === null ? (
          <p className={styles.empty} data-testid="practice-empty">
            Pick at least one interval above to start.
          </p>
        ) : (
          <>
            <div className={drill.playColumn}>
              <PlayButton
                size={112}
                aria-label="Play the interval"
                onClick={play}
                data-testid="practice-play"
              />
              <span className={drill.playLabel}>
                {played ? 'Play it again' : 'Play the interval'}
              </span>
              <span className={drill.prompt}>
                {question.direction === 'together'
                  ? 'Two notes at once. Which interval?'
                  : 'Which interval did you hear?'}
              </span>
            </div>

            <div className={drill.chips} data-testid="practice-chips">
              {settings.intervals.map((id) => {
                const iv = INTERVALS.find((i) => i.id === id);
                return (
                  <AnswerChip
                    key={id}
                    size="interval"
                    primary={id}
                    secondary={iv?.name ?? ''}
                    state={chipState(id, true, answered, question.interval, chosen)}
                    disabled={answered || !played}
                    onClick={() => pick(id)}
                    data-testid={`practice-answer-${id}`}
                  />
                );
              })}
            </div>

            {answered && (
              <FeedbackPanel
                correct={correct}
                {...feedbackFor(question, chosen, correct)}
                playback={null}
                keys={keys}
                onNext={() => advance(settings, question)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
