// /dev/components — every shared component in every variant, each wrapped in an element
// with data-testid="g-…" for e2e/components.spec.ts. Sample data from dev/fixtures.
import type { Sound } from '@cadence/content';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAudio } from '../audio/useAudio';
import { CircleOfFifths } from '../components/music/CircleOfFifths/CircleOfFifths';
import { keyStates, PianoKeyboard } from '../components/music/PianoKeyboard/PianoKeyboard';
import { AnswerChip } from '../components/ui/AnswerChip';
import { AppHeader } from '../components/ui/AppHeader';
import { BlockRow } from '../components/ui/BlockRow';
import { Callout } from '../components/ui/Callout';
import { Card } from '../components/ui/Card';
import { Confetti } from '../components/ui/Confetti';
import { DashedButton } from '../components/ui/DashedButton';
import { FeedbackPanel } from '../components/ui/FeedbackPanel';
import { PlayIcon, BulbIcon } from '../components/ui/icons';
import { InkButton } from '../components/ui/InkButton';
import { LegendSwatches } from '../components/ui/LegendSwatches';
import { ListeningIndicator } from '../components/ui/ListeningIndicator';
import { MidiPill } from '../components/ui/MidiPill';
import { NoteChips } from '../components/ui/NoteChips';
import { NumberedList } from '../components/ui/NumberedList';
import { OutlineInkButton } from '../components/ui/OutlineInkButton';
import { PlayButton } from '../components/ui/PlayButton';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ProgressBar } from '../components/ui/ProgressBar';
import { RomanChip, type RomanChipState } from '../components/ui/RomanChip';
import { SecondaryButton } from '../components/ui/SecondaryButton';
import { SegmentedProgress } from '../components/ui/SegmentedProgress';
import { ShowMeControl, type ShowMe } from '../components/ui/ShowMeControl';
import { StageRow } from '../components/ui/StageRow';
import { StatTile } from '../components/ui/StatTile';
import { StepCard } from '../components/ui/StepCard';
import { StreakPill } from '../components/ui/StreakPill';
import { TaskHeader } from '../components/ui/TaskHeader';
import { TextButton } from '../components/ui/TextButton';
import { TrackPills } from '../components/ui/TrackPills';
import { XpPill } from '../components/ui/XpPill';
import { useKeyboardFallbackActive } from '../midi/hooks';
import styles from './Dev.module.css';
import { completeFixture } from './fixtures/complete';
import { earChordFixture } from './fixtures/earChord';
import {
  earIntervalFixture,
  INTERVALS,
  intervalChipState,
  intervalSegments,
} from './fixtures/earInterval';
import { earKeyFixture } from './fixtures/earKey';
import { earPathFixture } from './fixtures/earPath';
import { learnFixture } from './fixtures/learn';
import { mainFixture } from './fixtures/main';
import { pathFixture, trackPills } from './fixtures/circlePath';
import {
  aMajorChords,
  chordSegments,
  chordStates,
  practiceFixture,
  practiceState,
} from './fixtures/practice';
import { midiStatuses, user } from './fixtures/user';

function Variant({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.variant} data-testid={`g-${id}`}>
      <span className={styles.label}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

const ALL_STATES: readonly RomanChipState[] = ['done', 'current', 'upcoming', 'skipped', 'hinted'];

const SOUNDS: ReadonlyArray<{ label: string; sound: Sound }> = [
  { label: 'Interval C → F', sound: { type: 'notes', notes: ['C4', 'F4'], gapMs: 800 } },
  { label: 'Chord C E G', sound: { type: 'chord', notes: ['C4', 'E4', 'G4'] } },
  { label: 'Cadence in G', sound: { type: 'cadence', key: 'G', mode: 'major' } },
  {
    label: 'Phrase in E minor',
    sound: { type: 'phrase', notes: ['E4', 'G4', 'F#4', 'E4', 'B3', 'D#4', 'F#4', 'E4'] },
  },
];

export function DevComponents() {
  const [showMe, setShowMe] = useState<ShowMe>(practiceState.vis);
  const [picked, setPicked] = useState<string | null>(null);
  const audio = useAudio();
  const keyboardActive = useKeyboardFallbackActive();
  const answered = picked !== null;

  return (
    <div className={styles.page} data-testid="dev-components">
      <div data-testid="g-app-header-today">
        <AppHeader
          active="today"
          streakDays={user.streakDays}
          xp={user.xp}
          showMidi
          midiStatus={midiStatuses.connected}
        />
      </div>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.h1}>Component gallery</h1>
          <p className={styles.lede}>
            Task 06 · every shared component in every variant, with design fixture data.
            {keyboardActive &&
              ' Computer keyboard is live: a w s e d f t g y h u j k o l p ; (z/x octave).'}
          </p>
          <div className={styles.links}>
            {[
              'main',
              'path',
              'learn',
              'practice',
              'complete',
              'ear-path',
              'ear-interval',
              'ear-chord',
              'ear-key',
            ].map((n) => (
              <Link key={n} to={`/dev/screens/${n}`}>
                /dev/screens/{n}
              </Link>
            ))}
          </div>
        </div>

        <Section title="Live MIDI · PianoKeyboard + MidiPill">
          <div className={styles.row}>
            <Variant id="midi-pill-live" label="MidiPill (live)">
              <MidiPill />
            </Variant>
            <Variant id="midi-pill-live-task" label="MidiPill task (live)">
              <MidiPill variant="task" />
            </Variant>
          </div>
          <Variant id="keyboard-live" label="two-octave · live held notes">
            <PianoKeyboard variant="two-octave" live data-testid="keyboard-live" />
          </Variant>
        </Section>

        <Section title="PianoKeyboard">
          <div className={styles.stack}>
            <Variant id="keyboard-two" label="two-octave · idle (Practice:90)">
              <PianoKeyboard variant="two-octave" data-testid="keyboard-two" />
            </Variant>
            <Variant id="keyboard-hint" label="two-octave · hint I = A3 C♯4 E4 (Practice:166–170)">
              <PianoKeyboard
                variant="two-octave"
                states={keyStates(aMajorChords[0]?.keys ?? [], 'hint')}
              />
            </Variant>
            <Variant id="keyboard-home" label="two-octave · home E, tried G A (EarKey:104–110)">
              <PianoKeyboard
                variant="two-octave"
                states={{
                  ...keyStates([...earKeyFixture.tried], 'tried'),
                  ...keyStates([...earKeyFixture.home], 'home'),
                }}
              />
            </Variant>
            <Variant id="keyboard-held" label="two-octave · held (sun) + correct over held">
              <PianoKeyboard
                variant="two-octave"
                states={keyStates(['C#4', 'E4', 'G#4'], 'correct')}
                held={new Set([49, 52, 64, 68])}
              />
            </Variant>
            <div className={styles.row}>
              <Variant id="keyboard-one" label="one-octave · idle (EarInterval:81)">
                <PianoKeyboard variant="one-octave" data-testid="keyboard-one" />
              </Variant>
              <Variant id="keyboard-one-correct" label="one-octave · C E G correct (EarChord:116)">
                <PianoKeyboard
                  variant="one-octave"
                  states={keyStates([...earChordFixture.litKeys], 'correct')}
                />
              </Variant>
              <Variant id="keyboard-one-black" label="one-octave · lit black keys">
                <PianoKeyboard
                  variant="one-octave"
                  states={{ ...keyStates(['C#4'], 'correct'), ...keyStates(['F#4'], 'hint') }}
                />
              </Variant>
            </div>
          </div>
        </Section>

        <Section title="CircleOfFifths (Path:93–129)">
          <Variant id="circle" label="A current · C G D done">
            <CircleOfFifths
              keys={pathFixture.keys}
              minors={pathFixture.minors}
              complete={pathFixture.complete}
              data-testid="circle"
            />
          </Variant>
        </Section>

        <Section title="Headers">
          <div className={styles.stack}>
            <Variant id="app-header-tracks" label="AppHeader · tracks, no MIDI pill (Path:20–37)">
              <AppHeader active="tracks" streakDays={user.streakDays} xp={user.xp} />
            </Variant>
            <Variant id="task-header-practice" label="TaskHeader · practice (Practice:22–37)">
              <TaskHeader
                backTo="/"
                backLabel={practiceFixture.header.back}
                title={practiceFixture.header.title}
                eyebrow={practiceFixture.header.eyebrow}
                eyebrowTone="tangerine"
                midiStatus={midiStatuses.connected}
              />
            </Variant>
            <Variant id="task-header-ear" label="TaskHeader · ear (EarInterval:22–37)">
              <TaskHeader
                backTo="/tracks"
                backLabel={earIntervalFixture.header.back}
                title={earIntervalFixture.header.title}
                eyebrow={earIntervalFixture.header.eyebrow}
                eyebrowTone="lavender"
                midiStatus={midiStatuses['no-device']}
              />
            </Variant>
            <Variant id="task-header-lesson" label="TaskHeader · lesson (Learn:20–27)">
              <TaskHeader
                variant="lesson"
                backTo="/tracks"
                backLabel={learnFixture.header.back}
                eyebrow={learnFixture.header.eyebrow}
                eyebrowTone="teal"
              />
            </Variant>
          </div>
        </Section>

        <Section title="Pills">
          <div className={styles.row}>
            <Variant id="streak-pill" label="StreakPill">
              <StreakPill days={user.streakDays} />
            </Variant>
            <Variant id="xp-pill" label="XpPill">
              <XpPill xp={user.xp} />
            </Variant>
            {Object.values(midiStatuses).map((s) => (
              <Variant key={s.kind} id={`midi-pill-${s.kind}`} label={`MidiPill · ${s.kind}`}>
                <MidiPill status={s} />
              </Variant>
            ))}
            <Variant id="midi-pill-task" label="MidiPill · task (pulsing)">
              <MidiPill status={midiStatuses.connected} variant="task" />
            </Variant>
          </div>
        </Section>

        <Section title="TrackPills (Path:41–47)">
          <Variant id="track-pills-major" label="major active">
            <TrackPills pills={trackPills('major')} />
          </Variant>
          <Variant id="track-pills-ear" label="ear active (EarPath:41–47)">
            <TrackPills pills={trackPills('ear')} />
          </Variant>
        </Section>

        <Section title="Buttons">
          <div className={styles.row}>
            <Variant id="primary-60" label="PrimaryButton 60 (Main:105)">
              <PrimaryButton size={60}>{mainFixture.cta}</PrimaryButton>
            </Variant>
            <Variant id="primary-56" label="PrimaryButton 56 (Practice:82)">
              <PrimaryButton>{practiceFixture.finished.cta}</PrimaryButton>
            </Variant>
            <Variant id="secondary" label="SecondaryButton (Complete:79)">
              <SecondaryButton>{completeFixture.done}</SecondaryButton>
            </Variant>
            <Variant id="secondary-icon" label="SecondaryButton + icon (Learn:87)">
              <SecondaryButton icon={<PlayIcon />}>{learnFixture.hear}</SecondaryButton>
            </Variant>
            <Variant id="outline-48" label="OutlineInkButton 48 (Practice:194)">
              <OutlineInkButton icon={<BulbIcon />}>
                {practiceFixture.hintLabels[0]}
              </OutlineInkButton>
            </Variant>
            <Variant id="outline-48-disabled" label="OutlineInkButton 48 disabled">
              <OutlineInkButton icon={<BulbIcon />} disabled>
                {practiceFixture.hintLabels[2]}
              </OutlineInkButton>
            </Variant>
            <Variant id="outline-60" label="OutlineInkButton 60 (EarKey:92)">
              <OutlineInkButton size={60}>{earKeyFixture.answers[0]}</OutlineInkButton>
            </Variant>
            <Variant id="ink" label="InkButton (EarInterval:89)">
              <InkButton>Next</InkButton>
            </Variant>
            <Variant id="text" label="TextButton (Practice:113)">
              <TextButton>{practiceFixture.skip}</TextButton>
            </Variant>
            <Variant id="text-underline" label="TextButton underline (Practice:112)">
              <TextButton underline>{practiceFixture.markPlayed}</TextButton>
            </Variant>
            <Variant id="dashed" label="DashedButton (Main:162)">
              <div className={styles.fixed}>
                <DashedButton>{mainFixture.addLabel}</DashedButton>
              </div>
            </Variant>
            <Variant id="play-112" label="PlayButton 112 (EarInterval:51)">
              <PlayButton
                aria-label="Play the interval"
                onClick={() => void audio.play({ type: 'notes', notes: ['C4', 'F4'], gapMs: 800 })}
              />
            </Variant>
            <Variant id="play-72" label="PlayButton 72 (EarChord:59)">
              <PlayButton
                size={72}
                aria-label="Hear the key of G major"
                onClick={() => void audio.play({ type: 'cadence', key: 'G', mode: 'major' })}
              />
            </Variant>
          </div>
        </Section>

        <Section title="Cards">
          <div className={styles.row}>
            <Variant id="card-default" label="default (Main:51)">
              <Card className={styles.fixed}>Today&apos;s practice</Card>
            </Variant>
            <Variant id="card-flat" label="flat (Path:58)">
              <Card variant="flat" className={styles.fixed}>
                {pathFixture.patternTitle}
              </Card>
            </Variant>
            <Variant id="card-track-active" label="track active (Main:119)">
              <Card variant="track" active className={styles.fixed}>
                {mainFixture.tracks.major.title}
                <ProgressBar value={mainFixture.tracks.major.progress} />
              </Card>
            </Variant>
            <Variant id="card-track" label="track (Main:133)">
              <Card variant="track" className={styles.fixed}>
                {mainFixture.tracks.minor.title}
                <ProgressBar value={mainFixture.tracks.minor.progress} tone="teal" />
              </Card>
            </Variant>
            <Variant id="card-highlight-tangerine" label="highlight tangerine (Path:78)">
              <Card variant="highlight" className={styles.fixed}>
                {pathFixture.upNext.title}
              </Card>
            </Variant>
            <Variant id="card-highlight-lavender" label="highlight lavender (EarPath:68)">
              <Card variant="highlight" tone="lavender" className={styles.fixed}>
                {earPathFixture.upNext.title}
              </Card>
            </Variant>
            <Variant id="card-row" label="row (Main:148)">
              <Card variant="row" className={styles.fixed}>
                <span>{mainFixture.tracks.rows[0].title}</span>
                <span>{mainFixture.tracks.rows[0].status}</span>
              </Card>
            </Variant>
            <Variant id="card-row-active" label="row available (Main:156)">
              <Card variant="row" active className={styles.fixed}>
                <span>{mainFixture.tracks.rows[2].title}</span>
                <span>{mainFixture.tracks.rows[2].status}</span>
              </Card>
            </Variant>
          </div>
          <Variant id="card-hero" label="hero (Complete:28)">
            <Card variant="hero" as="section">
              {completeFixture.title}
            </Card>
          </Variant>
        </Section>

        <Section title="RomanChip">
          <div className={styles.stack}>
            <Variant id="roman-48" label="quality · 48 (Path:68)">
              <div className={styles.chipRow}>
                {pathFixture.pattern.map((c) => (
                  <RomanChip
                    key={c.numeral}
                    mode="quality"
                    size={48}
                    numeral={c.numeral}
                    quality={c.quality}
                  />
                ))}
              </div>
            </Variant>
            {learnFixture.rows.map((row, r) => (
              <Variant
                key={row.label}
                id={`roman-52-${r}`}
                label={`quality · 52 · ${row.label} (Learn:44)`}
              >
                <div className={styles.chipRow}>
                  {row.chips.map((c) => (
                    <RomanChip
                      key={c.numeral}
                      mode="quality"
                      size={52}
                      numeral={c.numeral}
                      quality={c.quality}
                      emphasized={'pivot' in c && c.pivot}
                    />
                  ))}
                </div>
              </Variant>
            ))}
            <Variant id="roman-60" label="state · 60 (Complete:39–45)">
              <div className={styles.chipRow}>
                {completeFixture.chips.map((c) => (
                  <RomanChip
                    key={c.numeral}
                    mode="state"
                    size={60}
                    numeral={c.numeral}
                    sub={c.sub}
                    state={c.state}
                  />
                ))}
              </div>
            </Variant>
            <Variant id="roman-64" label="state · 64 (Practice:173–181)">
              <div className={styles.chipRow}>
                {aMajorChords.map((c, i) => (
                  <RomanChip
                    key={c.numeral}
                    mode="state"
                    size={64}
                    numeral={c.numeral}
                    sub={c.short}
                    state={chordStates(practiceState)[i] ?? 'upcoming'}
                  />
                ))}
              </div>
            </Variant>
            <Variant id="roman-states" label="state · every state">
              <div className={styles.chipRow}>
                {ALL_STATES.map((s) => (
                  <RomanChip key={s} mode="state" size={64} numeral="vii°" sub={s} state={s} />
                ))}
              </div>
            </Variant>
          </div>
        </Section>

        <Section title="AnswerChip">
          <Variant
            id="answer-interval"
            label={answered ? 'interval · answered' : 'interval · pick one (EarInterval:142)'}
          >
            <div className={styles.wrapRow}>
              {INTERVALS.map((iv) => (
                <AnswerChip
                  key={iv.id}
                  size="interval"
                  primary={iv.short}
                  secondary={iv.name}
                  state={intervalChipState(iv.id, answered)}
                  onClick={() => setPicked(iv.id)}
                />
              ))}
            </div>
          </Variant>
          <Variant
            id="answer-interval-answered"
            label="interval · answered P4 vs M3 (EarInterval:146–149)"
          >
            <div className={styles.wrapRow}>
              {INTERVALS.map((iv) => (
                <AnswerChip
                  key={iv.id}
                  size="interval"
                  primary={iv.short}
                  secondary={iv.name}
                  state={intervalChipState(iv.id, true)}
                />
              ))}
            </div>
          </Variant>
          <Variant id="answer-chord" label="chord · answered IV (EarChord:75–81)">
            <div className={styles.wrapRow}>
              {earChordFixture.chips.map((c) => (
                <AnswerChip
                  key={c.numeral}
                  size="chord"
                  primary={c.numeral}
                  secondary={c.name}
                  state={c.state}
                />
              ))}
            </div>
          </Variant>
          <Variant id="answer-chord-active" label="chord · active">
            <div className={styles.wrapRow}>
              {earChordFixture.chips.map((c) => (
                <AnswerChip
                  key={c.numeral}
                  size="chord"
                  primary={c.numeral}
                  secondary={c.name}
                  state="active"
                />
              ))}
            </div>
          </Variant>
        </Section>

        <Section title="Progress">
          <div className={styles.stack}>
            <Variant id="segments-420" label="SegmentedProgress · practice 420 (Practice:41)">
              <div className={styles.fixed}>
                <SegmentedProgress segments={chordSegments(practiceState)} maxWidth={420} />
              </div>
            </Variant>
            <Variant id="segments-520" label="SegmentedProgress · interval 520 (EarInterval:40)">
              <div style={{ width: 600, display: 'flex' }}>
                <SegmentedProgress segments={intervalSegments()} maxWidth={520} />
              </div>
            </Variant>
            <Variant id="segments-chord" label="SegmentedProgress · chord 520 (EarChord:40)">
              <div style={{ width: 600, display: 'flex' }}>
                <SegmentedProgress segments={earChordFixture.segments} maxWidth={520} />
              </div>
            </Variant>
            <Variant id="segments-300" label="SegmentedProgress · key 300 (EarKey:40)">
              <div style={{ width: 600, display: 'flex' }}>
                <SegmentedProgress segments={earKeyFixture.segments} maxWidth={300} />
              </div>
            </Variant>
            <Variant
              id="progress-bar"
              label="ProgressBar · 25% tangerine / 0% teal / 33.3% (Main:124, Complete:68)"
            >
              <div className={styles.stack} style={{ width: 520 }}>
                <ProgressBar value={0.25} />
                <ProgressBar value={0} tone="teal" />
                <ProgressBar value={completeFixture.progress} />
              </div>
            </Variant>
          </div>
        </Section>

        <Section title="Practice bits">
          <div className={styles.row}>
            <Variant id="show-me" label="ShowMeControl (Practice:48)">
              <ShowMeControl value={showMe} onChange={setShowMe} />
            </Variant>
            <Variant id="note-chips" label="NoteChips (Practice:70)">
              <NoteChips notes={aMajorChords[2]?.notes ?? []} />
            </Variant>
            <Variant id="listening" label="ListeningIndicator (Practice:102)">
              <ListeningIndicator />
            </Variant>
            <Variant id="legend-sm" label="LegendSwatches sm (Path:61)">
              <LegendSwatches size="sm" />
            </Variant>
            <Variant id="legend-md" label="LegendSwatches md (Learn:75)">
              <LegendSwatches size="md" />
            </Variant>
          </div>
          <Variant id="callout" label="Callout (Learn:54)">
            <div style={{ width: 780 }}>
              <Callout text={learnFixture.bridge} />
            </div>
          </Variant>
        </Section>

        <Section title="Rows">
          <div className={styles.row}>
            <Variant id="block-rows" label="BlockRow × 3 in a default card (Main:51–101)">
              <Card className={styles.fixed}>
                {mainFixture.blocks.map((b) => (
                  <BlockRow key={b.index} {...b} />
                ))}
              </Card>
            </Variant>
            <Variant id="stage-rows" label="StageRow × 5 (EarPath:80–158)">
              <div className={styles.fixed}>
                {earPathFixture.stages.map((s) => (
                  <StageRow key={s.index} {...s} />
                ))}
              </div>
            </Variant>
            <Variant id="numbered-list" label="NumberedList in a flat card (EarPath:58–66)">
              <Card variant="flat" className={styles.fixed}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{earPathFixture.howTitle}</span>
                <NumberedList items={earPathFixture.how} />
              </Card>
            </Variant>
          </div>
        </Section>

        <Section title="Feedback, stats, steps">
          <div className={styles.stack}>
            <Variant id="feedback-correct" label="FeedbackPanel · correct (EarChord:86)">
              <FeedbackPanel
                correct
                title={earChordFixture.feedback.title}
                body={earChordFixture.feedback.body}
                playback={earChordFixture.feedback.playback}
                keys={keyStates([...earChordFixture.litKeys], 'correct')}
                minTextWidth={280}
              />
            </Variant>
            <Variant id="feedback-wrong" label="FeedbackPanel · wrong (EarInterval:178)">
              <FeedbackPanel
                correct={false}
                title={earIntervalFixture.feedbackWrong.title}
                body={earIntervalFixture.feedbackWrong.body}
                playback={earIntervalFixture.feedbackWrong.playback}
                keys={keyStates([...earIntervalFixture.litKeys], 'correct')}
              />
            </Variant>
            <Variant id="stat-tiles" label="StatTile × 3 (Complete:48–61)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 220px)', gap: 12 }}>
                {completeFixture.stats.map((s) => (
                  <StatTile key={s.label} value={s.value} label={s.label} tone={s.tone} />
                ))}
              </div>
            </Variant>
            <Variant id="step-cards" label="StepCard done + current (EarKey:60–77)">
              <div style={{ display: 'flex', gap: 16, width: 900 }}>
                {earKeyFixture.steps.map((s) => (
                  <StepCard key={s.step} {...s} />
                ))}
              </div>
            </Variant>
          </div>
        </Section>

        <Section title="Audio (WebAudioSynth)">
          <Variant id="audio" label={audio.playing ? 'playing…' : 'tap to hear each Sound type'}>
            <div className={styles.row}>
              {SOUNDS.map((s) => (
                <SecondaryButton
                  key={s.label}
                  icon={<PlayIcon />}
                  onClick={() => void audio.play(s.sound)}
                >
                  {s.label}
                </SecondaryButton>
              ))}
            </div>
          </Variant>
        </Section>

        <Section title="Confetti (Complete:20–26)">
          <Variant id="confetti" label="seven shapes at the design's coordinates">
            <div className={styles.confettiBox}>
              <Confetti />
            </div>
          </Variant>
        </Section>
      </main>
    </div>
  );
}
