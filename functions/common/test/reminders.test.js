import { describe, expect, it, vi } from 'vitest';
import { createMemoryRepo } from '../src/repo/memory.js';
import { itemToRow } from '../src/mappers.js';
import { runReminderSweep, digestMessage, singleMessage } from '../src/reminders.js';

function fakeExpoFetch(calls) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    return {
      ok: true,
      json: async () => ({
        data: body.map((m) =>
          m.to.includes('dead') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' },
        ),
      }),
    };
  };
}

async function setup({ tz = 'UTC' } = {}) {
  const repo = createMemoryRepo();
  const u = await repo.users.insert({ email: 'a@x.io', name: 'A', google_sub: 'g1', timezone: tz });
  const s = await repo.spaces.insert({ name: 'Personal', type: 'personal', owner_user_id: u.ROWID });
  await repo.members.add(s.ROWID, u.ROWID);
  await repo.categories.insert({ space_id: null, key: 'food', name: 'Food', default_lead_days: 3, sort_order: 1 });
  await repo.devices.upsert({
    user_id: u.ROWID,
    platform: 'android',
    token: 'ExponentPushToken[live]',
    token_key: 'k1',
  });
  const add = (name, expiryDate, extra = {}) =>
    repo.items.insert({
      ...itemToRow({ spaceId: s.ROWID, name, expiryType: 'fixed', expiryDate, ...extra }),
      created_by: u.ROWID,
      updated_by: u.ROWID,
    });
  return { repo, u, s, add };
}

const push = { vapid: { publicKey: '', privateKey: '', subject: 'mailto:x@y.z' } };

describe('runReminderSweep', () => {
  it('sends lead reminders at 09:00 local, logs them, and never repeats', async () => {
    const { repo, add } = await setup();
    await add('Milk', '2026-10-30'); // lead (3 days) due on 2026-10-27
    const calls = [];
    const fetch = fakeExpoFetch(calls);

    // 08:00 UTC: too early.
    let r = await runReminderSweep(repo, { push, fetch, now: new Date('2026-10-27T08:00:00Z') });
    expect(r.reminders).toBe(0);
    expect(calls).toHaveLength(0);

    // 09:00 UTC: due.
    r = await runReminderSweep(repo, { push, fetch, now: new Date('2026-10-27T09:00:00Z') });
    expect(r.reminders).toBe(1);
    expect(r.notifications).toBe(1);
    expect(calls[0][0].title).toBe('Milk expires in 3 days');
    expect(calls[0][0].data.itemId).toBeTruthy();

    // 10:00 UTC same day: already logged.
    r = await runReminderSweep(repo, { push, fetch, now: new Date('2026-10-27T10:00:00Z') });
    expect(r.reminders).toBe(0);
    expect(repo._tables.reminder_log).toHaveLength(1);
  });

  it('respects the user time zone', async () => {
    const { repo, add } = await setup({ tz: 'Asia/Kolkata' });
    await add('Milk', '2026-10-30');
    const calls = [];
    const fetch = fakeExpoFetch(calls);
    // 03:30 UTC = 09:00 IST on 2026-10-27
    const r = await runReminderSweep(repo, { push, fetch, now: new Date('2026-10-27T03:30:00Z') });
    expect(r.reminders).toBe(1);
  });

  it('uses category lead days and item override', async () => {
    const { repo, add } = await setup();
    const food = repo._tables.categories[0];
    await add('Cream', '2026-11-10', { categoryId: food.ROWID, reminderLeadDays: 14 }); // lead on 10-27
    await add('Bread', '2026-10-30', { categoryId: food.ROWID }); // category lead 3 → 10-27
    await add('Far', '2026-12-25', { categoryId: food.ROWID }); // not due
    const calls = [];
    const r = await runReminderSweep(repo, {
      push,
      fetch: fakeExpoFetch(calls),
      now: new Date('2026-10-27T12:00:00Z'),
    });
    expect(r.reminders).toBe(2);
    expect(calls.flat().map((m) => m.title).sort()).toEqual([
      'Bread expires in 3 days',
      'Cream expires in 14 days',
    ]);
  });

  it('sends a digest when many items are due and removes dead devices', async () => {
    const { repo, u, add } = await setup();
    await repo.devices.upsert({
      user_id: u.ROWID,
      platform: 'android',
      token: 'ExponentPushToken[dead]',
      token_key: 'k2',
    });
    for (const n of ['A', 'B', 'C', 'D']) await add(n, '2026-10-27'); // all expire today
    const calls = [];
    const r = await runReminderSweep(repo, {
      push,
      fetch: fakeExpoFetch(calls),
      now: new Date('2026-10-27T09:30:00Z'),
    });
    // 4 items × (lead 10-24 is too old, day_of today) = 4 reminders, 1 digest × 2 devices
    expect(r.reminders).toBe(4);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(calls[0][0].title).toBe('4 items expiring soon');
    expect(repo._tables.devices.map((d) => d.token)).toEqual(['ExponentPushToken[live]']);
  });

  it('sends expired reminders the day after and skips consumed items', async () => {
    const { repo, add } = await setup();
    await add('Gone', '2026-10-26');
    await add('Eaten', '2026-10-26', { status: 'consumed' });
    const calls = [];
    const r = await runReminderSweep(repo, {
      push,
      fetch: fakeExpoFetch(calls),
      now: new Date('2026-10-27T09:00:00Z'),
    });
    // day_of (yesterday, within grace) and expired (today) are both logged,
    // but only the most urgent one is delivered.
    expect(r.reminders).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0][0].title).toBe('Gone has expired');
  });

  it('sends web push via injected sender', async () => {
    const { repo, u, add } = await setup();
    repo._tables.devices.length = 0;
    await repo.devices.upsert({
      user_id: u.ROWID,
      platform: 'web',
      token: JSON.stringify({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }),
      token_key: 'w1',
    });
    await add('Shampoo', '2026-10-27');
    const webSend = vi.fn(async () => ({}));
    const r = await runReminderSweep(repo, { push, webSend, now: new Date('2026-10-27T09:00:00Z') });
    expect(r.notifications).toBe(1);
    expect(webSend).toHaveBeenCalledTimes(1);
    expect(JSON.parse(webSend.mock.calls[0][1]).title).toBe('Shampoo expires today');
  });
});

describe('messages', () => {
  it('formats single and digest messages', () => {
    const item = { ROWID: '1', name: 'Milk', expiry_type: 'fixed', location: 'Fridge' };
    expect(singleMessage({ item, kind: 'lead', days: 2 })).toMatchObject({
      title: 'Milk expires in 2 days',
      body: 'In Fridge.',
    });
    expect(singleMessage({ item: { ...item, expiry_type: 'review' }, kind: 'day_of', days: 0 }).title).toBe(
      'Review Milk today',
    );
    const d = digestMessage([
      { item: { name: 'A' }, kind: 'lead' },
      { item: { name: 'B' }, kind: 'expired' },
      { item: { name: 'C' }, kind: 'day_of' },
      { item: { name: 'D' }, kind: 'lead' },
    ]);
    expect(d.title).toBe('3 items expiring soon, 1 expired');
    expect(d.body).toBe('A, B, C and 1 more');
  });
});
