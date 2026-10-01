import { pretty } from '@cadence/music';
import { cx } from '../../../lib/cx';
import styles from './CircleOfFifths.module.css';
import { NODE_SIZE, nodeBox, ringBox, type CircleNodeState } from './circleLayout';

export interface CircleKey {
  /** "C", "Gb" (rendered with pretty()). */
  label: string;
  state: CircleNodeState;
  /** Smaller label (Path:110 sets G♭ at 20px). */
  compact?: boolean;
  /** Done and current nodes are buttons. */
  onClick?: () => void;
  /** Accessible name for a done/current node (defaults to "<label> major, …"). */
  ariaLabel?: string;
}

export interface CircleOfFifthsProps {
  /** Twelve keys, clockwise from the top. */
  keys: readonly CircleKey[];
  /** Twelve relative minors, same order. */
  minors: readonly string[];
  complete: number;
  total?: number;
  /** Path:101 — "inner ring: relative minors" (the minor track's inner ring holds majors). */
  innerLabel?: string;
  'data-testid'?: string;
}

/** Path:93–129 — circle-of-fifths path map, nodes placed by trig (circleLayout.ts). */
export function CircleOfFifths({
  keys,
  minors,
  complete,
  total = 12,
  innerLabel = 'inner ring: relative minors',
  'data-testid': testId,
}: CircleOfFifthsProps) {
  const outer = ringBox('outer');
  const inner = ringBox('inner');
  return (
    <div className={styles.circle} data-testid={testId}>
      <div
        className={styles.ringOuter}
        style={{ left: outer.left, top: outer.top, width: outer.size, height: outer.size }}
      />
      <div
        className={styles.ringInner}
        style={{ left: inner.left, top: inner.top, width: inner.size, height: inner.size }}
      />

      <div className={styles.center}>
        <span className={styles.count}>
          {complete}
          <span className={styles.of}>/{total}</span>
        </span>
        <span className={styles.caption}>keys complete</span>
        <span className={styles.legend}>{innerLabel}</span>
      </div>

      {keys.map((k, i) => {
        const box = nodeBox(i, 'outer', NODE_SIZE[k.state]);
        const className = cx(styles.node, styles[k.state], k.compact && styles.compact);
        const style = { left: box.left, top: box.top };
        const label = pretty(k.label);
        return k.state === 'upcoming' ? (
          <div
            key={i}
            className={className}
            style={style}
            data-node="key"
            data-index={i}
            data-state={k.state}
          >
            {label}
          </div>
        ) : (
          <button
            key={i}
            type="button"
            className={className}
            style={style}
            onClick={k.onClick}
            aria-label={
              k.ariaLabel ?? `${label} major${k.state === 'current' ? ', up next' : ', complete'}`
            }
            data-node="key"
            data-index={i}
            data-state={k.state}
          >
            {label}
          </button>
        );
      })}

      {minors.map((m, i) => {
        const box = nodeBox(i, 'inner', NODE_SIZE.minor);
        return (
          <span
            key={i}
            className={styles.minor}
            style={{ left: box.left, top: box.top }}
            data-node="minor"
            data-index={i}
          >
            {pretty(m)}
          </span>
        );
      })}
    </div>
  );
}
