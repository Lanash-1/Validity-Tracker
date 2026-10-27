import {
  DEFAULT_REMINDER_LEAD_DAYS,
  type DisplayStatus,
  type ExpiryBucket,
  type ExpiryType,
  type ItemStatus,
  type ReminderKind,
} from './constants.js';
import { addDays, addMonths, compareDates, diffDays, minDate, type DateString } from './dates.js';

/** The subset of an item that the expiry rules depend on. */
export interface ExpiryFields {
  expiryType: ExpiryType;
  startDate?: DateString | null;
  expiryDate?: DateString | null;
  openedAt?: DateString | null;
  paoMonths?: number | null;
  reviewDate?: DateString | null;
}

/**
 * The single date the app sorts, buckets and reminds on.
 *
 * - fixed:         expiryDate
 * - period:        expiryDate (startDate is informational)
 * - after_opening: min(expiryDate, openedAt + paoMonths). Not opened yet → expiryDate.
 * - review:        reviewDate
 *
 * Returns null when the item has no usable date; such items sort last and
 * never trigger reminders.
 */
export function effectiveExpiry(item: ExpiryFields): DateString | null {
  switch (item.expiryType) {
    case 'fixed':
    case 'period':
      return item.expiryDate ?? null;
    case 'after_opening': {
      const pao =
        item.openedAt && item.paoMonths != null && item.paoMonths > 0
          ? addMonths(item.openedAt, item.paoMonths)
          : null;
      return minDate(item.expiryDate, pao);
    }
    case 'review':
      return item.reviewDate ?? null;
    default:
      return null;
  }
}

/** Days from `today` until `expiry` (negative when already past). */
export function daysUntil(expiry: DateString | null, today: DateString): number | null {
  if (!expiry) return null;
  return diffDays(today, expiry);
}

export function bucketForDays(days: number | null): ExpiryBucket {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'later';
}

export function bucketFor(item: ExpiryFields, today: DateString): ExpiryBucket {
  return bucketForDays(daysUntil(effectiveExpiry(item), today));
}

/** `expired` is derived: an active item whose effective expiry is before today. */
export function displayStatus(
  item: ExpiryFields & { status: ItemStatus },
  today: DateString,
): DisplayStatus {
  if (item.status !== 'active') return item.status;
  const exp = effectiveExpiry(item);
  if (exp && compareDates(exp, today) < 0) return 'expired';
  return 'active';
}

/** Has the validity period started yet (only meaningful for `period`)? */
export function hasStarted(item: ExpiryFields, today: DateString): boolean {
  if (item.expiryType !== 'period' || !item.startDate) return true;
  return compareDates(item.startDate, today) <= 0;
}

export interface ScheduledReminder {
  kind: ReminderKind;
  /** Calendar date on which the reminder should fire (in the user's zone). */
  date: DateString;
}

/**
 * The reminders an item should produce, given the lead time that applies to
 * it (item override → category default → global default).
 */
export function reminderSchedule(
  item: ExpiryFields,
  leadDays: number | null | undefined,
): ScheduledReminder[] {
  const exp = effectiveExpiry(item);
  if (!exp) return [];
  const lead = leadDays ?? DEFAULT_REMINDER_LEAD_DAYS;
  const out: ScheduledReminder[] = [];
  if (lead > 0) out.push({ kind: 'lead', date: addDays(exp, -lead) });
  out.push({ kind: 'day_of', date: exp });
  // Review-type items have no "expired" moment: the review date is the only nudge.
  if (item.expiryType !== 'review') out.push({ kind: 'expired', date: addDays(exp, 1) });
  return out;
}

export function resolveLeadDays(
  itemLeadDays: number | null | undefined,
  categoryLeadDays: number | null | undefined,
): number {
  if (itemLeadDays != null) return itemLeadDays;
  if (categoryLeadDays != null) return categoryLeadDays;
  return DEFAULT_REMINDER_LEAD_DAYS;
}

/**
 * Whether a reminder scheduled for `scheduled` is due to be sent now, given
 * the user's local date and hour. Reminders fire from `fireHour` on their
 * date and stay eligible for `graceDays` more days so that a cron outage or
 * a device that was offline does not swallow them. Anything older is dropped.
 */
export function isReminderDue(
  scheduled: DateString,
  localToday: DateString,
  localHour: number,
  fireHour: number,
  graceDays = 1,
): boolean {
  const age = diffDays(scheduled, localToday); // 0 on the day, positive afterwards
  if (age < 0) return false;
  if (age > graceDays) return false;
  if (age === 0 && localHour < fireHour) return false;
  return true;
}

/** Sort helper: by effective expiry ascending, nulls last, then by name. */
export function compareByExpiry<T extends ExpiryFields & { name: string }>(a: T, b: T): number {
  const ea = effectiveExpiry(a);
  const eb = effectiveExpiry(b);
  if (ea && eb) {
    const c = compareDates(ea, eb);
    if (c !== 0) return c;
  } else if (ea && !eb) return -1;
  else if (!ea && eb) return 1;
  return a.name.localeCompare(b.name);
}
