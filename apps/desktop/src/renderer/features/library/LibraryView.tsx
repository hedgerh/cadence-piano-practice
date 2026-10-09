// `/tracks` — the track library (decisions.md 2026-10-08 "Track library"; not in the designs).
// Built from the Main.dc.html track card (Main:119–145) and the Path page's intro type scale.
import { AppHeader } from '../../components/ui/AppHeader';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { cx } from '../../lib/cx';
import { LIBRARY_SUBTITLE, type LibraryCard, type LibrarySection } from './library';
import styles from './LibraryPage.module.css';

export interface LibraryViewProps {
  streakDays: number;
  xp: number;
  /** Undefined while `plan.getToday` loads (the header and intro still render). */
  sections: readonly LibrarySection[] | undefined;
}

export function LibraryView({ streakDays, xp, sections }: LibraryViewProps) {
  return (
    <div className={styles.page} data-testid="library">
      <AppHeader active="tracks" streakDays={streakDays} xp={xp} />
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.h1}>Tracks</h1>
          <p className={styles.subtitle}>{LIBRARY_SUBTITLE}</p>
        </div>
        {sections?.map((s) => (
          <section
            key={s.group}
            className={styles.section}
            aria-labelledby={`group-${s.group}`}
            data-testid="library-section"
          >
            <h2 id={`group-${s.group}`} className={styles.h2}>
              {s.group}
            </h2>
            <div className={styles.grid}>
              {s.cards.map((c) => (
                <LibraryTrackCard key={c.trackId} card={c} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function LibraryTrackCard({ card }: { card: LibraryCard }) {
  return (
    <Card
      variant="track"
      active={card.tone === 'warm'}
      to={card.to ?? undefined}
      className={cx(styles.card, card.tone === 'muted' && styles.cardMuted)}
      data-testid={`library-card-${card.trackId}`}
    >
      <div className={styles.head}>
        <span className={styles.title}>{card.title}</span>
        <span className={cx(styles.status, styles[card.tone])} data-testid="library-card-status">
          {card.status}
        </span>
      </div>
      <p className={styles.blurb}>{card.blurb}</p>
      {card.progress !== null && (
        <ProgressBar
          value={card.progress}
          tone={card.tone === 'warm' ? 'tangerine' : 'teal'}
          aria-label={`${card.title} progress`}
        />
      )}
      {(card.progressText !== null || card.joined) && (
        <div className={styles.foot}>
          <span>{card.progressText}</span>
          {card.nextText !== null && <span className={styles.next}>{card.nextText}</span>}
        </div>
      )}
      {card.joined && (
        <span className={styles.joined} data-testid="library-card-joined">
          In your daily plan
        </span>
      )}
    </Card>
  );
}
