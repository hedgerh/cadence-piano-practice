import styles from './NumberedList.module.css';

/** EarPath:58–66 — "How a level works". */
export function NumberedList({ items }: { items: readonly string[] }) {
  return (
    <ol className={styles.list} data-testid="numbered-list">
      {items.map((text, i) => (
        <li key={i} className={styles.item}>
          <span className={styles.number}>{i + 1}</span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}
