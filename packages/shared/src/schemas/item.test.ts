import { describe, expect, it } from 'vitest';
import { createItemSchema, registerDeviceSchema } from './index.js';

const base = { spaceId: '1', name: 'Biscuits' };

describe('createItemSchema', () => {
  it('requires expiryDate for fixed', () => {
    expect(createItemSchema.safeParse({ ...base, expiryType: 'fixed' }).success).toBe(false);
    expect(
      createItemSchema.safeParse({ ...base, expiryType: 'fixed', expiryDate: '2026-12-01' }).success,
    ).toBe(true);
  });

  it('requires an ordered start/end for period', () => {
    expect(
      createItemSchema.safeParse({
        ...base,
        expiryType: 'period',
        startDate: '2026-12-10',
        expiryDate: '2026-12-01',
      }).success,
    ).toBe(false);
    expect(
      createItemSchema.safeParse({
        ...base,
        expiryType: 'period',
        startDate: '2026-12-01',
        expiryDate: '2026-12-01',
      }).success,
    ).toBe(true);
  });

  it('after_opening needs PAO months plus at least one date', () => {
    expect(
      createItemSchema.safeParse({ ...base, expiryType: 'after_opening', paoMonths: 6 }).success,
    ).toBe(false);
    expect(
      createItemSchema.safeParse({
        ...base,
        expiryType: 'after_opening',
        paoMonths: 6,
        openedAt: '2026-10-01',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown fields and bad dates', () => {
    expect(
      createItemSchema.safeParse({
        ...base,
        expiryType: 'fixed',
        expiryDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(
      createItemSchema.safeParse({
        ...base,
        expiryType: 'fixed',
        expiryDate: '2026-12-01',
        hacker: true,
      }).success,
    ).toBe(false);
  });
});

describe('registerDeviceSchema', () => {
  it('accepts Expo tokens for android and subscriptions for web', () => {
    expect(
      registerDeviceSchema.safeParse({
        platform: 'android',
        token: 'ExponentPushToken[abc123]',
      }).success,
    ).toBe(true);
    expect(
      registerDeviceSchema.safeParse({
        platform: 'web',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
          keys: { p256dh: 'k', auth: 'a' },
        },
      }).success,
    ).toBe(true);
    expect(registerDeviceSchema.safeParse({ platform: 'web', token: 'x' }).success).toBe(false);
  });
});
