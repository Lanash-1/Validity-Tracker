import { describeDays, type Item, daysUntil, bucketForDays, hasStarted, type ExpiryBucket } from '@vt/shared';
import { today } from './today';

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, day!));
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function itemDays(item: Pick<Item, 'effectiveExpiry'>): number | null {
  return daysUntil(item.effectiveExpiry, today());
}

export function itemBucket(item: Pick<Item, 'effectiveExpiry'>): ExpiryBucket {
  return bucketForDays(itemDays(item));
}

/** "Expires in 3 days", "Expired 2 days ago", "Review today", "Starts in 4 days" */
export function expiryLabel(item: Item): string {
  const t = today();
  if (item.expiryType === 'period' && !hasStarted(item, t)) {
    const d = daysUntil(item.startDate ?? null, t);
    return d === null ? 'Not started' : `Starts ${describeDays(d)}`;
  }
  const d = itemDays(item);
  if (d === null) return item.expiryType === 'after_opening' ? 'Not opened yet' : 'No date';
  const verb = item.expiryType === 'review' ? 'Review' : item.expiryType === 'period' ? 'Ends' : 'Expires';
  if (d < 0) return item.expiryType === 'review' ? `Review was due ${describeDays(d)}` : `Expired ${describeDays(d)}`;
  return `${verb} ${describeDays(d)}`;
}

export function quantityLabel(item: Pick<Item, 'quantity' | 'unit'>): string | null {
  if (item.quantity == null) return null;
  return `${item.quantity} ${item.unit ?? ''}`.trim();
}
