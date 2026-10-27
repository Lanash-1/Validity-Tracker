import { z } from 'zod';
import { PLATFORMS } from '../constants.js';
import { idString } from './common.js';

export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
export type WebPushSubscription = z.infer<typeof webPushSubscriptionSchema>;

export const registerDeviceSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('android'),
    /** Expo push token, e.g. ExponentPushToken[xxxxxxxx]. */
    token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/),
    label: z.string().trim().max(120).optional(),
  }),
  z.object({
    platform: z.literal('web'),
    subscription: webPushSubscriptionSchema,
    label: z.string().trim().max(120).optional(),
  }),
  z.object({
    platform: z.literal('extension'),
    subscription: webPushSubscriptionSchema,
    label: z.string().trim().max(120).optional(),
  }),
]);
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const deviceSchema = z.object({
  id: idString,
  platform: z.enum(PLATFORMS),
  label: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
});
export type Device = z.infer<typeof deviceSchema>;
