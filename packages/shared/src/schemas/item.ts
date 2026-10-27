import { z } from 'zod';
import { EXPIRY_TYPES, ITEM_STATUSES, UNITS } from '../constants.js';
import { dateString, idString, paginationQuery } from './common.js';

const expiryCore = {
  expiryType: z.enum(EXPIRY_TYPES),
  startDate: dateString.nullable().optional(),
  expiryDate: dateString.nullable().optional(),
  openedAt: dateString.nullable().optional(),
  paoMonths: z.number().int().min(1).max(120).nullable().optional(),
  reviewDate: dateString.nullable().optional(),
};

/**
 * Per-type requirements. These run on both client and server so the add
 * form and the API agree about what a valid item looks like.
 */
function refineExpiry(
  v: {
    expiryType: (typeof EXPIRY_TYPES)[number];
    startDate?: string | null;
    expiryDate?: string | null;
    openedAt?: string | null;
    paoMonths?: number | null;
    reviewDate?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  switch (v.expiryType) {
    case 'fixed':
      if (!v.expiryDate)
        ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Expiry date is required' });
      break;
    case 'period':
      if (!v.startDate)
        ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Start date is required' });
      if (!v.expiryDate)
        ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'End date is required' });
      if (v.startDate && v.expiryDate && v.startDate > v.expiryDate)
        ctx.addIssue({
          code: 'custom',
          path: ['expiryDate'],
          message: 'End date must be on or after the start date',
        });
      break;
    case 'after_opening':
      if (!v.paoMonths)
        ctx.addIssue({
          code: 'custom',
          path: ['paoMonths'],
          message: 'Months after opening is required',
        });
      if (!v.expiryDate && !v.openedAt)
        ctx.addIssue({
          code: 'custom',
          path: ['expiryDate'],
          message: 'Provide the printed expiry date, the opened date, or both',
        });
      break;
    case 'review':
      if (!v.reviewDate)
        ctx.addIssue({ code: 'custom', path: ['reviewDate'], message: 'Review date is required' });
      break;
  }
}

export const itemSchema = z.object({
  id: idString,
  spaceId: idString,
  name: z.string(),
  brand: z.string().nullable(),
  categoryId: idString.nullable(),
  barcode: z.string().nullable(),
  photoUrl: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  location: z.string().nullable(),
  ...expiryCore,
  /** Server-computed; see `effectiveExpiry()`. */
  effectiveExpiry: dateString.nullable(),
  reminderLeadDays: z.number().int().nullable(),
  notes: z.string().nullable(),
  status: z.enum(ITEM_STATUSES),
  createdBy: idString,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

export const createItemSchema = z
  .object({
    spaceId: idString,
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().max(80).nullable().optional(),
    categoryId: idString.nullable().optional(),
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{4,32}$/)
      .nullable()
      .optional(),
    quantity: z.number().min(0).max(1_000_000).nullable().optional(),
    unit: z.enum(UNITS).nullable().optional(),
    location: z.string().trim().max(60).nullable().optional(),
    ...expiryCore,
    reminderLeadDays: z.number().int().min(0).max(365).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .superRefine(refineExpiry);
export type CreateItemInput = z.infer<typeof createItemSchema>;

/** Everything optional; the API merges with the stored row before re-validating. */
export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    brand: z.string().trim().max(80).nullable().optional(),
    categoryId: idString.nullable().optional(),
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{4,32}$/)
      .nullable()
      .optional(),
    quantity: z.number().min(0).max(1_000_000).nullable().optional(),
    unit: z.enum(UNITS).nullable().optional(),
    location: z.string().trim().max(60).nullable().optional(),
    expiryType: z.enum(EXPIRY_TYPES).optional(),
    startDate: dateString.nullable().optional(),
    expiryDate: dateString.nullable().optional(),
    openedAt: dateString.nullable().optional(),
    paoMonths: z.number().int().min(1).max(120).nullable().optional(),
    reviewDate: dateString.nullable().optional(),
    reminderLeadDays: z.number().int().min(0).max(365).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(ITEM_STATUSES).optional(),
  })
  .strict();
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/** Validates a fully merged item payload (used server-side after PATCH merge). */
export const expiryFieldsSchema = z.object(expiryCore).superRefine(refineExpiry);

export const consumeItemSchema = z.object({
  /** Amount to subtract. Omit to consume the whole item. */
  quantity: z.number().positive().optional(),
});
export type ConsumeItemInput = z.infer<typeof consumeItemSchema>;

export const listItemsQuerySchema = paginationQuery.extend({
  spaceId: idString.optional(),
  status: z.enum(['active', 'consumed', 'archived', 'expired', 'all']).default('active'),
  categoryId: idString.optional(),
  location: z.string().optional(),
  q: z.string().trim().max(120).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  sort: z.enum(['expiry', 'created', 'name']).default('expiry'),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

export const calendarQuerySchema = z.object({
  spaceId: idString.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarResponseSchema = z.object({
  month: z.string(),
  days: z.record(z.string(), z.number().int()),
  items: z.array(itemSchema),
});
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;

export const productLookupSchema = z.object({
  barcode: z.string(),
  name: z.string().nullable(),
  brand: z.string().nullable(),
  imageUrl: z.string().nullable(),
  quantity: z.string().nullable(),
  source: z.string(),
});
export type ProductLookup = z.infer<typeof productLookupSchema>;
