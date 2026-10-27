export const EXPIRY_TYPES = ['fixed', 'period', 'after_opening', 'review'] as const;
export type ExpiryType = (typeof EXPIRY_TYPES)[number];

export const ITEM_STATUSES = ['active', 'consumed', 'archived'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** `expired` is derived from the date at read time; it is never stored. */
export type DisplayStatus = ItemStatus | 'expired';

export const SPACE_TYPES = ['personal', 'shared'] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

export const PLATFORMS = ['android', 'web', 'extension'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const REMINDER_KINDS = ['lead', 'day_of', 'expired'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const EXPIRY_BUCKETS = ['expired', 'today', 'week', 'month', 'later', 'none'] as const;
export type ExpiryBucket = (typeof EXPIRY_BUCKETS)[number];

export const BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: 'Expired',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  later: 'Later',
  none: 'No date',
};

export const DEFAULT_REMINDER_LEAD_DAYS = 3;

/** Local hour (0-23) at which daily reminders are delivered. */
export const REMINDER_HOUR = 9;

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface BuiltInCategory {
  /** Stable key used to look the category up across environments. */
  key: string;
  name: string;
  icon: string;
  defaultLeadDays: number;
  sortOrder: number;
}

export const BUILT_IN_CATEGORIES: readonly BuiltInCategory[] = [
  { key: 'food', name: 'Food', icon: '🍪', defaultLeadDays: 3, sortOrder: 10 },
  { key: 'beverages', name: 'Beverages', icon: '🥤', defaultLeadDays: 3, sortOrder: 20 },
  { key: 'cosmetics', name: 'Cosmetics', icon: '🧴', defaultLeadDays: 14, sortOrder: 30 },
  { key: 'medicine', name: 'Medicine', icon: '💊', defaultLeadDays: 14, sortOrder: 40 },
  { key: 'household', name: 'Household', icon: '🧹', defaultLeadDays: 7, sortOrder: 50 },
  { key: 'documents', name: 'Documents', icon: '📄', defaultLeadDays: 30, sortOrder: 60 },
  { key: 'warranty', name: 'Warranty', icon: '🛠️', defaultLeadDays: 30, sortOrder: 70 },
  { key: 'offers', name: 'Offers & Coupons', icon: '🏷️', defaultLeadDays: 2, sortOrder: 80 },
  { key: 'subscriptions', name: 'Subscriptions', icon: '🔁', defaultLeadDays: 7, sortOrder: 90 },
  { key: 'other', name: 'Other', icon: '📦', defaultLeadDays: 3, sortOrder: 100 },
];

export const UNITS = ['pcs', 'pack', 'g', 'kg', 'ml', 'l', 'tablet', 'dose', 'other'] as const;
