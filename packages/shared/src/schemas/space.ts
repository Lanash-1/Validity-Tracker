import { z } from 'zod';
import { SPACE_TYPES } from '../constants.js';
import { idString, inviteCode } from './common.js';

export const spaceMemberSchema = z.object({
  userId: idString,
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  joinedAt: z.string(),
});
export type SpaceMember = z.infer<typeof spaceMemberSchema>;

export const spaceSchema = z.object({
  id: idString,
  name: z.string(),
  type: z.enum(SPACE_TYPES),
  icon: z.string().nullable(),
  ownerUserId: idString,
  /** Only present for shared spaces the caller belongs to. */
  inviteCode: z.string().nullable(),
  memberCount: z.number().int(),
  createdAt: z.string(),
});
export type Space = z.infer<typeof spaceSchema>;

export const createSpaceSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    icon: z.string().trim().max(8).optional(),
  })
  .strict();
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;

export const updateSpaceSchema = createSpaceSchema.partial();
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;

export const joinSpaceSchema = z.object({ inviteCode });
export type JoinSpaceInput = z.infer<typeof joinSpaceSchema>;
