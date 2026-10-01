import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import styles from './Card.module.css';

export type CardVariant = 'default' | 'flat' | 'track' | 'highlight' | 'hero' | 'row' | 'stage';

export interface CardProps {
  /**
   * default Main:51 · flat Path:58 · track Main:119 · highlight Path:78 / EarPath:68 ·
   * hero Complete:28 · row Main:148 · stage EarPath:87
   */
  variant?: CardVariant;
  /** highlight only: tangerine (Path:78) or lavender (EarPath:68). */
  tone?: 'tangerine' | 'lavender';
  /** track: tangerine border · row: line-strong border · stage: current (tangerine + shadow). */
  active?: boolean;
  /** Renders a router Link (the whole card is the tap target). */
  to?: string | undefined;
  as?: 'div' | 'section';
  className?: string | undefined;
  children: ReactNode;
  'data-testid'?: string;
}

export function Card({
  variant = 'default',
  tone = 'tangerine',
  active = false,
  to,
  as = 'div',
  className,
  children,
  'data-testid': testId,
}: CardProps) {
  const classes = cx(
    styles.card,
    styles[variant],
    variant === 'highlight' && (tone === 'lavender' ? styles.toneLavender : styles.toneTangerine),
    active && variant === 'track' && styles.trackActive,
    active && variant === 'row' && styles.rowActive,
    active && variant === 'stage' && styles.stageActive,
    className,
  );
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} data-testid={testId}>
        {children}
      </Link>
    );
  }
  const Tag = as;
  return (
    <Tag className={classes} data-testid={testId}>
      {children}
    </Tag>
  );
}
