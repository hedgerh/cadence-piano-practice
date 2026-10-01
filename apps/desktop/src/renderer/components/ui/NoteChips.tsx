import { pretty } from '@cadence/music';
import styles from './NoteChips.module.css';

/** Practice:69–75 — the first hint: the chord's note names. */
export function NoteChips({ notes }: { notes: readonly string[] }) {
  return (
    <div className={styles.chips} data-testid="note-chips">
      {notes.map((n, i) => (
        <span key={`${n}-${i}`} className={styles.chip}>
          {pretty(n)}
        </span>
      ))}
    </div>
  );
}
