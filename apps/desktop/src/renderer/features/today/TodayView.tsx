import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AppHeader } from '../../components/ui/AppHeader';
import { BlockRow } from '../../components/ui/BlockRow';
import { Card } from '../../components/ui/Card';
import { DashedButton } from '../../components/ui/DashedButton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import type { MidiStatus } from '../../midi/MidiInput';
import { blockStates, ctaNote, partitionTracks, type TodayDto } from './today';
import { TrackCard, TrackRow } from './TrackCard';
import styles from './TodayPage.module.css';

export interface TodayViewProps {
  greeting: string;
  streakDays: number;
  xp: number;
  /** The plan; undefined while it loads (header and greeting still render). */
  today: TodayDto | undefined;
  /** Live MIDI status (drives the CTA note); the header pill reads the store unless overridden. */
  midi: MidiStatus;
  /** Overrides the header pill's status (dev fixtures). */
  midiOverride?: MidiStatus | undefined;
  onCta: () => void;
  ctaBusy?: boolean;
  onAddTrack: () => void;
  /** Rendered after the page (AddTrackDialog). */
  children?: ReactNode;
}

/** Main.dc.html — the Today screen, fed by `plan.getToday` (or a fixture in /dev/screens/today). */
export function TodayView({
  greeting,
  streakDays,
  xp,
  today,
  midi,
  midiOverride,
  onCta,
  ctaBusy = false,
  onAddTrack,
  children,
}: TodayViewProps) {
  const states = today ? blockStates(today.blocks) : [];
  const { cards, rows } = partitionTracks(today?.tracks ?? []);
  const allDone = today?.allDone ?? false;
  const subtitle = allDone ? (today?.cta.subtitle ?? today?.subtitle) : today?.subtitle;

  return (
    <div className={styles.page} data-testid="today">
      <AppHeader
        active="today"
        streakDays={streakDays}
        xp={xp}
        showMidi
        midiStatus={midiOverride}
      />
      <main className={styles.main}>
        <section className={styles.practice}>
          <div className={styles.intro}>
            <h1 className={styles.h1} data-testid="today-greeting">
              {greeting}
            </h1>
            {subtitle !== undefined && <p className={styles.subtitle}>{subtitle}</p>}
          </div>

          {today && today.blocks.length > 0 && (
            <Card data-testid="today-plan">
              <div className={styles.planHead}>
                <h2 className={styles.h2}>Today&apos;s practice</h2>
                <span className={styles.planMeta}>{today.summary}</span>
              </div>
              {today.blocks.map((b, i) => (
                <BlockRow
                  key={b.id}
                  index={i + 1}
                  state={states[i] ?? 'upcoming'}
                  kind={b.type}
                  eyebrow={b.eyebrow}
                  detail={b.meta}
                  title={b.title}
                  blurb={b.blurb}
                  last={i === today.blocks.length - 1}
                />
              ))}
            </Card>
          )}

          {today && (
            <div className={styles.ctaRow}>
              {allDone ? (
                <SecondaryButton to={today.cta.route} data-testid="today-extra">
                  Practice something extra
                </SecondaryButton>
              ) : (
                <PrimaryButton size={60} onClick={onCta} disabled={ctaBusy} data-testid="today-cta">
                  {today.cta.label}
                </PrimaryButton>
              )}
              <span className={styles.ctaNote} data-testid="today-cta-note">
                {ctaNote({ allDone, streakDays, midi })}
              </span>
            </div>
          )}
        </section>

        <aside className={styles.tracks}>
          <div className={styles.tracksHead}>
            <h2 className={styles.h2}>Your tracks</h2>
            <Link to="/tracks" className={styles.mapLink}>
              See the map
            </Link>
          </div>
          {cards.map((t) => (
            <TrackCard key={t.trackId} track={t} />
          ))}
          {rows.length > 0 && (
            <div className={styles.rows}>
              {rows.map((t) => (
                <TrackRow key={t.trackId} track={t} />
              ))}
            </div>
          )}
          <DashedButton onClick={onAddTrack} data-testid="add-track">
            Add something to learn
          </DashedButton>
        </aside>
      </main>
      {children}
    </div>
  );
}
