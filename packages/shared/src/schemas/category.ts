import { z } from 'zod';
import { idString } from './common.js';

export const categorySchema = z.object({
  id: idString,
  /** null for built-in categories available in every space. */
  spaceId: idString.nullable(),
  key: z.string().nullable(),
  name: z.string(),
  icon: z.string().nullable(),
  defaultLeadDays: z.number().int().min(0),
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    icon: z.string().trim().max(8).optional(),
    defaultLeadDays: z.number().int().min(0).max(365).default(3),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
