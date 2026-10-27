import { todayInTimeZone } from '@vt/shared';

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Today's calendar date in the device's time zone. */
export function today(): string {
  return todayInTimeZone(deviceTimeZone());
}
