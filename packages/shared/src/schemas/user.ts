import { z } from 'zod';
import { PLATFORMS } from '../constants.js';
import { idString, timeZoneString } from './common.js';

export const userSchema = z.object({
  id: idString,
  email: z.string().email(),
  name: z.string().min(1).max(120),
  avatarUrl: z.string().url().nullable(),
  timezone: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    timezone: timeZoneString.optional(),
  })
  .strict();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const googleSignInSchema = z.object({
  idToken: z.string().min(20),
  platform: z.enum(PLATFORMS),
  deviceLabel: z.string().trim().max(120).optional(),
  timezone: timeZoneString.optional(),
});
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authResponseSchema = authTokensSchema.extend({ user: userSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;
