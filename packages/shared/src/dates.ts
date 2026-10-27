/**
 * Date-only helpers. All dates in Validity Tracker are ISO calendar dates
 * (`YYYY-MM-DD`) interpreted in the user's time zone. Keeping them as strings
 * avoids every DST / UTC-offset pitfall that comes with `Date` objects.
 */

export type DateString = string; // YYYY-MM-DD

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(value: unknown): value is DateString {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  return d >= 1 && d <= daysInMonth(y, mo);
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parts(date: DateString): { y: number; m: number; d: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date string: ${date}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateString(y: number, m: number, d: number): DateString {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Days since 1970-01-01 for a calendar date (no time zone involved). */
export function toEpochDays(date: DateString): number {
  const { y, m, d } = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromEpochDays(days: number): DateString {
  const dt = new Date(days * 86_400_000);
  return toDateString(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: DateString, days: number): DateString {
  return fromEpochDays(toEpochDays(date) + days);
}

/**
 * Adds calendar months, clamping the day to the end of the target month
 * (2026-01-31 + 1 month = 2026-02-28). This matches how "period after
 * opening" labels on cosmetics are read.
 */
export function addMonths(date: DateString, months: number): DateString {
  const { y, m, d } = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return toDateString(ny, nm, nd);
}

/** b - a in whole days. Positive when b is after a. */
export function diffDays(a: DateString, b: DateString): number {
  return toEpochDays(b) - toEpochDays(a);
}

export function compareDates(a: DateString, b: DateString): number {
  return toEpochDays(a) - toEpochDays(b);
}

export function minDate(...dates: Array<DateString | null | undefined>): DateString | null {
  let best: DateString | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (best === null || compareDates(d, best) < 0) best = d;
  }
  return best;
}

/** Monday-based weekday index (0 = Monday ... 6 = Sunday). */
export function weekdayIndex(date: DateString): number {
  const { y, m, d } = parts(date);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (js + 6) % 7;
}

export function startOfMonth(date: DateString): DateString {
  const { y, m } = parts(date);
  return toDateString(y, m, 1);
}

export function endOfMonth(date: DateString): DateString {
  const { y, m } = parts(date);
  return toDateString(y, m, daysInMonth(y, m));
}

/** `YYYY-MM` for a date. */
export function monthKey(date: DateString): string {
  return date.slice(0, 7);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date right now in a given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): DateString {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA formats as YYYY-MM-DD
  return fmt.format(now);
}

/** Hour of day (0-23) right now in a given IANA time zone. */
export function hourInTimeZone(timeZone: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const part = fmt.formatToParts(now).find((p) => p.type === 'hour');
  return part ? Number(part.value) : now.getUTCHours();
}

/** Human-friendly relative description, e.g. "in 3 days", "today", "2 days ago". */
export function describeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1) return `in ${days} days`;
  return `${-days} days ago`;
}
