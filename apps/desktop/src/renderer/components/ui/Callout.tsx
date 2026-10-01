import type { ReactNode } from 'react';
import styles from './Callout.module.css';
import { ArrowDownIcon } from './icons';

/** Render `**bold**` markup (content's Lesson.bridge) as <strong>. */
export function renderBold(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

/** Learn:54–57 — the bridge between the two lesson rows. */
export function Callout({ text }: { text: string }) {
  return (
    <div className={styles.callout} data-testid="callout">
      <ArrowDownIcon size={22} strokeWidth={2.4} />
      <span className={styles.text}>{renderBold(text)}</span>
    </div>
  );
}
