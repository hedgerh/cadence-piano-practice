// Find the key (EarKey.dc.html) — placeholder until Task 15 replaces it. EarDrillPage routes
// levels whose steps use a `root` match here.
import { Card } from '../../components/ui/Card';
import { TaskHeader } from '../../components/ui/TaskHeader';
import styles from './ChoiceDrill.module.css';
import type { EarSession } from './earDrillReducer';

export interface KeyDrillProps {
  session: EarSession;
  backTo: string;
}

export function KeyDrill({ session, backTo }: KeyDrillProps) {
  return (
    <div className={styles.page} data-testid="key-drill">
      <TaskHeader
        backTo={backTo}
        backLabel="Ear training"
        title={session.shortTitle}
        eyebrow="Find the key"
        eyebrowTone="lavender"
      />
      <main className={styles.main}>
        <Card variant="flat">
          <span className={styles.question}>Find the key arrives in Task 15.</span>
          <span className={styles.prompt}>
            {session.questions.length} phrases are ready for this level.
          </span>
        </Card>
      </main>
    </div>
  );
}
