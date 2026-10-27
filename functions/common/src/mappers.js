import { effectiveExpiry } from '@vt/shared';

/**
 * Row ↔ DTO mapping. Rows use snake_case columns as stored in Catalyst Data
 * Store; DTOs are the camelCase shapes in @vt/shared.
 */

const nul = (v) => (v === undefined || v === '' ? null : v);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v) => (v === null || v === undefined ? null : String(v));

export function userFromRow(r) {
  return {
    id: String(r.ROWID),
    email: r.email,
    name: r.name,
    avatarUrl: nul(r.avatar_url),
    timezone: r.timezone || 'UTC',
    createdAt: r.CREATEDTIME,
  };
}

export function spaceFromRow(r, { memberCount = 1, includeInvite = true } = {}) {
  return {
    id: String(r.ROWID),
    name: r.name,
    type: r.type,
    icon: nul(r.icon),
    ownerUserId: String(r.owner_user_id),
    inviteCode: r.type === 'shared' && includeInvite ? nul(r.invite_code) : null,
    memberCount,
    createdAt: r.CREATEDTIME,
  };
}

export function categoryFromRow(r) {
  return {
    id: String(r.ROWID),
    spaceId: str(nul(r.space_id)),
    key: nul(r.key),
    name: r.name,
    icon: nul(r.icon),
    defaultLeadDays: Number(r.default_lead_days ?? 3),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

export function itemFromRow(r) {
  return {
    id: String(r.ROWID),
    spaceId: String(r.space_id),
    name: r.name,
    brand: nul(r.brand),
    categoryId: str(nul(r.category_id)),
    barcode: nul(r.barcode),
    photoUrl: nul(r.photo_url),
    quantity: num(r.quantity),
    unit: nul(r.unit),
    location: nul(r.location),
    expiryType: r.expiry_type,
    startDate: nul(r.start_date),
    expiryDate: nul(r.expiry_date),
    openedAt: nul(r.opened_at),
    paoMonths: num(r.pao_months),
    reviewDate: nul(r.review_date),
    effectiveExpiry: nul(r.effective_expiry),
    reminderLeadDays: num(r.reminder_lead_days),
    notes: nul(r.notes),
    status: r.status,
    createdBy: String(r.created_by),
    createdAt: r.CREATEDTIME,
    updatedAt: r.MODIFIEDTIME,
  };
}

/** Sentinel so "no date" sorts after every real date in ZCQL ORDER BY. */
export const NO_DATE_SORT = '9999-12-31';

/** Builds the stored row for an item create/update from a validated DTO. */
export function itemToRow(input) {
  const eff = effectiveExpiry(input);
  return {
    space_id: input.spaceId,
    name: input.name,
    brand: input.brand ?? null,
    category_id: input.categoryId ?? null,
    barcode: input.barcode ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    location: input.location ?? null,
    expiry_type: input.expiryType,
    start_date: input.startDate ?? null,
    expiry_date: input.expiryDate ?? null,
    opened_at: input.openedAt ?? null,
    pao_months: input.paoMonths ?? null,
    review_date: input.reviewDate ?? null,
    effective_expiry: eff,
    expiry_sort: eff ?? NO_DATE_SORT,
    reminder_lead_days: input.reminderLeadDays ?? null,
    notes: input.notes ?? null,
    status: input.status ?? 'active',
  };
}

export function deviceFromRow(r) {
  return {
    id: String(r.ROWID),
    platform: r.platform,
    label: nul(r.label),
    createdAt: r.CREATEDTIME,
    lastSeenAt: r.last_seen_at || r.MODIFIEDTIME,
  };
}
