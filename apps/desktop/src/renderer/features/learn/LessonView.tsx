import type { LessonChip } from '@cadence/content';
import type { Note } from '@cadence/music';
import { useState } from 'react';
import { keyStates, PianoKeyboard } from '../../components/music/PianoKeyboard/PianoKeyboard';
import { Callout } from '../../components/ui/Callout';
import { PlayIcon } from '../../components/ui/icons';
import { LegendSwatches } from '../../components/ui/LegendSwatches';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { RomanChip } from '../../components/ui/RomanChip';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { TaskHeader } from '../../components/ui/TaskHeader';
import { cx } from '../../lib/cx';
import styles from './LearnPage.module.css';

/** The parts of a content `Lesson` (engine.md §2.1) the screen renders. */
export interface LessonContent {
  title: string;
  eyebrow: string;
  intro: string;
  rows: readonly { label: string; caption: string; chips: readonly LessonChip[] }[];
  /** Chord shapes, one tile each over a shared keyboard (decisions.md 2026-10-10). */
  voicings?: readonly { label: string; caption: string; notes: readonly Note[] }[] | undefined;
  /** `**x**` marks bold text. */
  bridge: string;
  cta: string;
  hear?: { label: string } | undefined;
}

export interface LessonViewProps {
  lesson: LessonContent;
  /** The track map the back link returns to. */
  backTo: string;
  /** Flattened chip index (row by row) currently sounding, or null. */
  sounding: number | null;
  playing: boolean;
  onHear: () => void;
  onCta: () => void;
  ctaBusy?: boolean;
  /** Index of the voicing whose chord is sounding (from "Hear"), or null. */
  soundingVoicing?: number | null;
  /** A voicing tile was picked: play that shape. */
  onVoicing?: (index: number) => void;
}

/** Header eyebrow (Learn:25). */
export const LESSON_HEADER_EYEBROW = 'Lesson · about 1 minute';

/** Index of the sounding chip within row `r`, or null. */
export function soundingInRow(
  rows: LessonContent['rows'],
  r: number,
  sounding: number | null,
): number | null {
  if (sounding === null) return null;
  const offset = rows.slice(0, r).reduce((n, row) => n + row.chips.length, 0);
  const local = sounding - offset;
  return local >= 0 && local < (rows[r]?.chips.length ?? 0) ? local : null;
}

/** Learn.dc.html — a structured lesson: chip rows, bridge callout, legend, CTA + hear. */
export function LessonView({
  lesson,
  backTo,
  sounding,
  playing,
  onHear,
  onCta,
  ctaBusy = false,
  soundingVoicing = null,
  onVoicing,
}: LessonViewProps) {
  const [picked, setPicked] = useState(0);
  const voicings = lesson.voicings ?? [];
  const shown = soundingVoicing ?? picked;
  const shownNotes = voicings[shown]?.notes ?? [];
  const shapes = voicings.length > 0 && (
    <div className={styles.shapes} data-testid="lesson-voicings">
      <div className={styles.tiles}>
        {voicings.map((v, i) => (
          <button
            key={i}
            type="button"
            className={cx(styles.tile, i === shown && styles.tileOn)}
            aria-pressed={i === shown}
            onClick={() => {
              setPicked(i);
              onVoicing?.(i);
            }}
            data-testid={`lesson-voicing-${i}`}
          >
            <span className={styles.tileLabel}>{v.label}</span>
            <span className={styles.rowCaption}>{v.caption}</span>
          </button>
        ))}
      </div>
      <PianoKeyboard
        variant="two-octave"
        states={keyStates(shownNotes, soundingVoicing !== null ? 'correct' : 'hint')}
        data-testid="lesson-keyboard"
      />
    </div>
  );

  const rows = lesson.rows.map((row, r) => {
    const active = soundingInRow(lesson.rows, r, sounding);
    return (
      <div key={r} className={styles.row} data-testid={`lesson-row-${r}`}>
        <div className={styles.rowHead}>
          <span className={styles.rowLabel}>{row.label}</span>
          <span className={styles.rowCaption}>{row.caption}</span>
        </div>
        <div
          className={styles.chips}
          data-sounding={active ?? undefined}
          data-testid={`lesson-chips-${r}`}
        >
          {row.chips.map((c, i) => (
            <RomanChip
              key={i}
              mode="quality"
              size={52}
              numeral={c.numeral}
              quality={c.quality}
              emphasized={c.pivot === true}
              className={cx(
                i === active && styles.sounding,
                i === active && c.pivot === true && styles.soundingPivot,
              )}
              data-testid={`lesson-chip-${r}-${i}`}
            />
          ))}
        </div>
      </div>
    );
  });

  return (
    <div className={styles.page} data-testid="learn">
      <TaskHeader
        variant="lesson"
        backTo={backTo}
        backLabel="Tracks"
        eyebrow={LESSON_HEADER_EYEBROW}
        eyebrowTone="teal"
      />
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>{lesson.eyebrow}</span>
          <h1 className={styles.h1} data-testid="learn-title">
            {lesson.title}
          </h1>
          <p className={styles.lede}>{lesson.intro}</p>
        </div>

        <div className={styles.card} data-testid="lesson-card">
          {shapes}
          {rows[0]}
          {/* Learn:54 — the bridge sits between the first two rows (after the shapes). */}
          <Callout text={lesson.bridge} />
          {rows.slice(1)}
          {rows.length > 0 && <LegendSwatches size="md" />}
        </div>

        <div className={styles.actions}>
          <PrimaryButton onClick={onCta} disabled={ctaBusy} data-testid="learn-cta">
            {lesson.cta}
          </PrimaryButton>
          {lesson.hear && (
            <SecondaryButton
              icon={<PlayIcon size={18} />}
              onClick={onHear}
              disabled={playing}
              data-testid="learn-hear"
            >
              {lesson.hear.label}
            </SecondaryButton>
          )}
        </div>
      </main>
    </div>
  );
}
