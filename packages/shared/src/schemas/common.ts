import { z } from 'zod';
import { isDateString, isValidTimeZone } from '../dates.js';

export const dateString = z
  .string()
  .refine(isDateString, { message: 'Expected a calendar date in YYYY-MM-DD format' });

export const nullableDate = dateString.nullable().optional();

export const idString = z.string().min(1).max(40);

export const timeZoneString = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, { message: 'Unknown IANA time zone' });

export const inviteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{8}$/, 'Invite codes are 8 letters or digits');

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type Paginated<T> = { items: T[]; nextCursor: string | null };

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
