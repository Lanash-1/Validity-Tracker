import { describe, expect, it } from 'vitest';
import {
  bucketFor,
  bucketForDays,
  compareByExpiry,
  displayStatus,
  effectiveExpiry,
  hasStarted,
  isReminderDue,
  reminderSchedule,
  resolveLeadDays,
} from './expiry.js';

const today = '2026-10-27';

describe('effectiveExpiry', () => {
  it('fixed and period use the expiry date', () => {
    expect(effectiveExpiry({ expiryType: 'fixed', expiryDate: '2026-11-01' })).toBe('2026-11-01');
    expect(
      effectiveExpiry({ expiryType: 'period', startDate: '2026-10-01', expiryDate: '2026-11-01' }),
    ).toBe('2026-11-01');
    expect(effectiveExpiry({ expiryType: 'fixed' })).toBeNull();
  });

  it('after_opening takes the earlier of printed expiry and opened + PAO', () => {
    expect(
      effectiveExpiry({
        expiryType: 'after_opening',
        expiryDate: '2028-01-01',
        openedAt: '2026-10-01',
        paoMonths: 6,
      }),
    ).toBe('2027-04-01');
    expect(
      effectiveExpiry({
        expiryType: 'after_opening',
        expiryDate: '2026-12-01',
        openedAt: '2026-10-01',
        paoMonths: 6,
      }),
    ).toBe('2026-12-01');
    // Not opened yet: fall back to the printed date.
    expect(
      effectiveExpiry({ expiryType: 'after_opening', expiryDate: '2028-01-01', paoMonths: 12 }),
    ).toBe('2028-01-01');
    // Neither known.
    expect(effectiveExpiry({ expiryType: 'after_opening', paoMonths: 12 })).toBeNull();
  });

  it('review uses the review date', () => {
    expect(effectiveExpiry({ expiryType: 'review', reviewDate: '2027-01-15' })).toBe('2027-01-15');
  });
});

describe('buckets and status', () => {
  it('buckets by days until expiry', () => {
    expect(bucketForDays(null)).toBe('none');
    expect(bucketForDays(-1)).toBe('expired');
    expect(bucketForDays(0)).toBe('today');
    expect(bucketForDays(1)).toBe('week');
    expect(bucketForDays(7)).toBe('week');
    expect(bucketForDays(8)).toBe('month');
    expect(bucketForDays(30)).toBe('month');
    expect(bucketForDays(31)).toBe('later');
    expect(bucketFor({ expiryType: 'fixed', expiryDate: '2026-10-29' }, today)).toBe('week');
  });

  it('derives expired only for active items', () => {
    expect(
      displayStatus({ expiryType: 'fixed', expiryDate: '2026-10-26', status: 'active' }, today),
    ).toBe('expired');
    expect(
      displayStatus({ expiryType: 'fixed', expiryDate: '2026-10-27', status: 'active' }, today),
    ).toBe('active');
    expect(
      displayStatus({ expiryType: 'fixed', expiryDate: '2026-10-26', status: 'consumed' }, today),
    ).toBe('consumed');
  });

  it('knows whether a validity period has started', () => {
    expect(
      hasStarted({ expiryType: 'period', startDate: '2026-11-01', expiryDate: '2026-11-30' }, today),
    ).toBe(false);
    expect(
      hasStarted({ expiryType: 'period', startDate: '2026-10-27', expiryDate: '2026-11-30' }, today),
    ).toBe(true);
    expect(hasStarted({ expiryType: 'fixed', expiryDate: '2026-11-30' }, today)).toBe(true);
  });
});

describe('reminders', () => {
  it('schedules lead, day-of and expired reminders', () => {
    expect(reminderSchedule({ expiryType: 'fixed', expiryDate: '2026-11-10' }, 3)).toEqual([
      { kind: 'lead', date: '2026-11-07' },
      { kind: 'day_of', date: '2026-11-10' },
      { kind: 'expired', date: '2026-11-11' },
    ]);
  });

  it('skips lead when lead is 0 and skips expired for review items', () => {
    expect(reminderSchedule({ expiryType: 'review', reviewDate: '2026-11-10' }, 0)).toEqual([
      { kind: 'day_of', date: '2026-11-10' },
    ]);
  });

  it('returns nothing without a date', () => {
    expect(reminderSchedule({ expiryType: 'fixed' }, 3)).toEqual([]);
  });

  it('resolves lead days by precedence', () => {
    expect(resolveLeadDays(5, 10)).toBe(5);
    expect(resolveLeadDays(0, 10)).toBe(0);
    expect(resolveLeadDays(null, 10)).toBe(10);
    expect(resolveLeadDays(undefined, undefined)).toBe(3);
  });

  it('decides when a reminder is due with a grace window', () => {
    // Before fire hour on the day: not yet.
    expect(isReminderDue('2026-10-27', '2026-10-27', 8, 9)).toBe(false);
    expect(isReminderDue('2026-10-27', '2026-10-27', 9, 9)).toBe(true);
    // Future: never.
    expect(isReminderDue('2026-10-28', '2026-10-27', 23, 9)).toBe(false);
    // One day late (cron outage): still sent, regardless of hour.
    expect(isReminderDue('2026-10-26', '2026-10-27', 2, 9)).toBe(true);
    // Two days late: dropped.
    expect(isReminderDue('2026-10-25', '2026-10-27', 12, 9)).toBe(false);
  });
});

describe('compareByExpiry', () => {
  it('sorts ascending with null dates last and names as tiebreak', () => {
    const items = [
      { name: 'b', expiryType: 'fixed' as const, expiryDate: '2026-11-01' },
      { name: 'z', expiryType: 'fixed' as const, expiryDate: null },
      { name: 'a', expiryType: 'fixed' as const, expiryDate: '2026-11-01' },
      { name: 'c', expiryType: 'review' as const, reviewDate: '2026-10-01' },
    ];
    expect([...items].sort(compareByExpiry).map((i) => i.name)).toEqual(['c', 'a', 'b', 'z']);
  });
});
