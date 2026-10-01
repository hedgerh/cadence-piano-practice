// Local calendar-day helpers. Days are `YYYY-MM-DD` strings in the profile's timezone.
// Never derive a local day with `toISOString().slice(0, 10)` (that is the UTC day).

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, f);
  }
  return f;
}

/** The local calendar day of `epochMs` in the IANA `timezone`. */
export function localDay(epochMs: number, timezone: string): string {
  let year = '';
  let month = '';
  let day = '';
  for (const part of formatterFor(timezone).formatToParts(new Date(epochMs))) {
    if (part.type === 'year') year = part.value;
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'day') day = part.value;
  }
  return `${year.padStart(4, '0')}-${month}-${day}`;
}

function toUtcMs(day: string): number {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Invalid day "${day}" (expected YYYY-MM-DD)`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Calendar arithmetic on a `YYYY-MM-DD` day (no timezone involved). */
export function addDays(day: string, n: number): string {
  return fromUtcMs(toUtcMs(day) + n * MS_PER_DAY);
}

/** Whole calendar days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}
