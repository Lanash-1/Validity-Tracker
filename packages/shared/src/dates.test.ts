import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  diffDays,
  hourInTimeZone,
  isDateString,
  minDate,
  todayInTimeZone,
  weekdayIndex,
} from './dates.js';

describe('dates', () => {
  it('validates calendar dates strictly', () => {
    expect(isDateString('2026-02-28')).toBe(true);
    expect(isDateString('2028-02-29')).toBe(true); // leap year
    expect(isDateString('2026-02-29')).toBe(false);
    expect(isDateString('2026-13-01')).toBe(false);
    expect(isDateString('2026-1-01')).toBe(false);
    expect(isDateString('26-01-01')).toBe(false);
    expect(isDateString(20260101)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('adds months clamping to end of month (cosmetics PAO)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 13)).toBe('2027-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29');
    expect(addMonths('2026-05-15', 12)).toBe('2027-05-15');
    expect(addMonths('2026-11-10', 3)).toBe('2027-02-10');
  });

  it('computes signed day differences', () => {
    expect(diffDays('2026-10-27', '2026-10-30')).toBe(3);
    expect(diffDays('2026-10-27', '2026-10-27')).toBe(0);
    expect(diffDays('2026-10-27', '2026-10-20')).toBe(-7);
  });

  it('picks the earliest non-null date', () => {
    expect(minDate(null, '2026-05-01', undefined, '2026-04-01')).toBe('2026-04-01');
    expect(minDate(null, undefined)).toBeNull();
  });

  it('computes Monday-based weekday index', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-01')).toBe(6); // Sunday
  });

  it('resolves today and hour in a time zone', () => {
    const now = new Date('2026-10-27T22:30:00Z');
    expect(todayInTimeZone('UTC', now)).toBe('2026-10-27');
    expect(todayInTimeZone('Asia/Kolkata', now)).toBe('2026-10-28'); // 04:00 IST next day
    expect(hourInTimeZone('Asia/Kolkata', now)).toBe(4);
    expect(todayInTimeZone('America/Los_Angeles', now)).toBe('2026-10-27');
    expect(hourInTimeZone('America/Los_Angeles', now)).toBe(15);
  });
});
