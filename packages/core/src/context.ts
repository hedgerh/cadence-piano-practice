// Shared dependencies handed to every service by createServices().
import type { ContentService } from './content.service';
import { systemTimezone } from './dates';
import type { Clock, Repos } from './ports';

export interface ServiceContext {
  repos: Repos;
  content: ContentService;
  clock: Clock;
}

/** The profile's IANA timezone, or the host's before onboarding. */
export function timezoneOf(ctx: ServiceContext): string {
  return ctx.repos.profile.get()?.timezone ?? systemTimezone();
}

/** Today's local day in the profile's timezone (engine.md §4: Intl.DateTimeFormat). */
export function todayOf(ctx: ServiceContext): string {
  return ctx.clock.today(timezoneOf(ctx));
}

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** "seven" for 7; digits above twelve. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "A", "A and B", "A, B and C". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** "up and down" → "Up and down". */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
