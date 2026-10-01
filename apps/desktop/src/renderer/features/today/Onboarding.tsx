import { useState, type FormEvent } from 'react';
import { Card } from '../../components/ui/Card';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import styles from './Onboarding.module.css';

export interface OnboardingProps {
  onSubmit: (name: string) => void;
  busy?: boolean;
}

/**
 * First run (ui.md §3 row `/`; engine.md §4 SettingsService): one field, the learner's name.
 * Not in the designs — composed from the hero Card (Complete:28), Main:47's h1 and the 60px CTA.
 */
export function Onboarding({ onSubmit, busy = false }: OnboardingProps) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && !busy) onSubmit(trimmed);
  };

  return (
    <div className={styles.page} data-testid="onboarding">
      <div className={styles.wordmark}>Cadence</div>
      <main className={styles.main}>
        <Card variant="hero">
          <div className={styles.intro}>
            <h1 className={styles.h1}>Welcome to Cadence.</h1>
            <p className={styles.lede}>
              A few minutes of theory at your keyboard each day. No tempo, no rush.
            </p>
          </div>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.label} htmlFor="onboarding-name">
              What should we call you?
            </label>
            <input
              id="onboarding-name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="given-name"
              maxLength={40}
              placeholder="Your name"
              data-testid="onboarding-name"
            />
            <PrimaryButton
              size={60}
              type="submit"
              disabled={!trimmed || busy}
              data-testid="onboarding-submit"
            >
              Let&apos;s play
            </PrimaryButton>
          </form>
        </Card>
      </main>
    </div>
  );
}
